# Especificación Técnica: Flujo de Onboarding SaaS Multitenant

## 🎯 Objetivo
Transformar la arquitectura actual de registro de usuarios en un modelo **SaaS Multitenant**. Cada nuevo registro de usuario debe desencadenar la creación de un nuevo **Tenant** único, permitiendo el aislamiento de datos y la gestión individual de planes, tiendas y equipos de trabajo.

## 🔍 Análisis del Estado Actual
Actualmente, el método `AuthService.register` espera recibir un `tenantId` en el payload:
```typescript
async register(data: { ..., tenantId: string; }): Promise<User>
```
Esto implica que el sistema actual no es capaz de crear un Tenant de forma autónoma durante el registro, delegando la responsabilidad de la existencia del Tenant al cliente (frontend), lo cual rompe el principio de aislamiento SaaS.

## 🏗️ Propuesta de Modelado de Datos

Para soportar el nuevo flujo, se requiere la implementación/ajuste de las siguientes entidades:

### 1. `Tenant` (El contenedor de la cuenta)
Representa la organización o empresa que consume el servicio.
- `id` (UUID, PK)
- `name` (String)
- `status` (Enum: `ACTIVE`, `SUSPENDED`, `TRIAL`)
- `createdAt` (Timestamp)

### 2. `User` (Identidad y Membresía)
- `id` (UUID, PK)
- `tenantId` (UUID, FK $\rightarrow$ `Tenant.id`)
- `email` (String, Unique)
- `password` (String)
- `name` (String)
- `role` (Enum: `OWNER`, `ADMIN`, `MEMBER`) - *Rol dentro del Tenant*

### 3. `Subscription` (Gestión de Planes y Trial)
- `id` (UUID, PK)
- `tenantId` (UUID, FK $\rightarrow$ `Tenant.id`)
- `planType` (Enum: `TRIAL`, `BASIC`, `PREMIUM`)
- `status` (Enum: `ACTIVE`, `EXPIRED`, `CANCELED`)
- `startDate` (Timestamp)
- `trialEndDate` (Timestamp) - *Calculado automáticamente al iniciar el trial*

### 4. `Store` (Conexión con Shopify)
- `id` (UUID, PK)
- `tenantId` (UUID, FK $\rightarrow$ `Tenant.id`)
- `shopifyShopId` (String, Unique)
- `accessToken` (String, Encrypted)
- `role` (Enum: `SOURCE`, `VENDOR`) - *Define si la tienda expone o consume productos*
- `isActive` (Boolean)

### 5. `TeamMember` (Invitaciones y Roles de Equipo)
- `id` (UUID, PK)
- `tenantId` (UUID, FK $\rightarrow$ `Tenant.id`)
- `userId` (UUID, FK $\rightarrow$ `User.id`)
- `role` (String)

## 🚀 Flujo de Onboarding (Multi-pasos)

El acceso a las funcionalidades principales de la plataforma estará bloqueado hasta que se completen los siguientes pasos:

### Paso 1: Selección de Plan
- **Acción:** El usuario elige un plan (o decide iniciar el trial).
- **Backend:** 
    1. Crea el `Tenant`.
    2. Crea el `User` asociado al `Tenant`.
    3. Crea la `Subscription` con `planType: TRIAL` y `trialEndDate: now + 7 days`.
- **Estado de Configuración:** `PENDING_STORE_CONFIG`

### Paso 2: Configuración de la Tienda
- **Acción:** Conexión con Shopify mediante el `access_token` de la Custom App.
- **Backend:** Crea la entidad `Store` vinculada al `tenantId`.
- **Estado de Configuración:** `PENDING_STORE_ROLE`

### Paso 3: Configuración del Rol de la Tienda
- **Acción:** El usuario selecciona si su tienda es `SOURCE` (proveedora) o `VENDOR` (destino).
- **Backend:** Actualiza `Store.role`.
- **Estado de Configuración:** `PENDING_TEAM_CONFIG` (o `COMPLETED` si se salta el paso 4).

### Paso 4: Configuración del Equipo (Opcional)
- **Acción:** El usuario invita a otros miembros por email.
- **Backend:** Crea registros en `TeamMember` y envía invitaciones.
- **Estado de Configuración:** `COMPLETED`

## 🔐 Reglas de Negocio y Seguridad

1. **Bloqueo de Acceso:** Implementar un `Guard` de NestJS que verifique el `configurationStatus` del Tenant/Usuario. Si no es `COMPLETED`, solo se permiten rutas de `/onboarding/*`.
2. **Aislamiento (Multi-tenancy):** Todas las consultas de negocio (productos, pedidos, etc.) deben incluir obligatoriamente el filtro `tenantId` en el `WHERE` de la base de datos.
3. **Gestión de Trial:** Un proceso de background (Cron job) debe marcar las suscripciones como `EXPIRED` una vez superada la fecha `trialEndDate`.
