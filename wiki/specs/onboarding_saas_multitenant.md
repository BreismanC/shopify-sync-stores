# Especificación Técnica: Flujo de Onboarding SaaS Multitenant

## 🎯 Objetivo

Transformar la arquitectura actual de registro de usuarios en un modelo **SaaS Multitenant**. Cada nuevo registro de usuario debe desencadenar la creación de un nuevo **Tenant** único, permitiendo el aislamiento de datos y la gestión individual de planes, tiendas y equipos de trabajo.

## 🔍 Análisis del Estado Actual

El sistema tiene dos flujos de registro diferenciados:

- **Registro tradicional (formulario):** Crea `Tenant` + `Subscription` + `User` automáticamente.
- **Registro social (Google/Facebook):** Crea `User` con `tenantId: null`. El `Tenant` se crea en el onboarding mediante upsert.

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
- `tenantId` (UUID, FK → `Tenant.id`, **nullable**)
- `email` (String, Unique)
- `password` (String, nullable)
- `name` (String)
- `role` (Enum: `OWNER`, `ADMIN`, `MEMBER`) - *Rol dentro del Tenant*
- `onboardingStatus` (Enum: estados del onboarding)

### 3. `Subscription` (Gestión de Planes y Trial)

- `id` (UUID, PK)
- `tenantId` (UUID, FK → `Tenant.id`)
- `planType` (Enum: `TRIAL`, `BASIC`, `PREMIUM`)
- `status` (Enum: `ACTIVE`, `EXPIRED`, `CANCELED`)
- `startDate` (Timestamp)
- `trialEndDate` (Timestamp)

### 4. `Store` (Conexión con Shopify)

- `id` (UUID, PK)
- `tenantId` (UUID, FK → `Tenant.id`)
- `shopifyShopId` (String, Unique)
- `accessToken` (String, Encrypted)
- `role` (Enum: `SOURCE`, `VENDOR`)
- `isActive` (Boolean)

### 5. `TeamMember` (Invitaciones y Roles de Equipo)

- `id` (UUID, PK)
- `tenantId` (UUID, FK → `Tenant.id`)
- `userId` (UUID, FK → `User.id`)
- `role` (String)

## 🚀 Flujo de Onboarding (Multi-pasos)

El acceso a las funcionalidades principales de la plataforma estará bloqueado hasta que se completen los siguientes pasos:

### Paso 1: Configurar Empresa (Upsert de Tenant)

- **Acción:** El usuario ingresa el nombre de su empresa.
- **Backend (Upsert):**
  - Si el usuario tiene `tenantId` existente: Actualiza el nombre del `Tenant`.
  - Si el usuario NO tiene `tenantId`: Crea un nuevo `Tenant` y lo asigna al usuario.
  - Crea/actualiza la `Subscription` con `planType: TRIAL`.
- **Estado de Configuración:** `PENDING_STORE_CONFIG` → `PENDING_STORE_ROLE`

**Importante:** Este paso NO se salta para usuarios sociales. El usuario social llegó a onboarding con `tenantId: null` y debe ingresar el nombre de su empresa para crear el tenant.

### Paso 2: Conectar Tienda Shopify

- **Acción:** Conexión con Shopify mediante el `access_token` de la Custom App.
- **Backend:** Crea la entidad `Store` vinculada al `tenantId`.
- **Estado de Configuración:** `PENDING_STORE_ROLE` → `PENDING_TEAM_CONFIG`

### Paso 3: Configurar Rol de la Tienda

- **Acción:** El usuario selecciona si su tienda es `SOURCE` (proveedora) o `VENDOR` (destino).
- **Backend:** Actualiza `Store.role`.
- **Estado de Configuración:** `PENDING_TEAM_CONFIG`

### Paso 4: Configurar Equipo (Opcional)

- **Acción:** El usuario invita a otros miembros por email.
- **Backend:** Crea registros en `TeamMember` y envía invitaciones.
- **Estado de Configuración:** `COMPLETED`

## 🔐 Reglas de Negocio y Seguridad

1. **Bloqueo de Acceso:** Implementar un `OnboardingGuard` que verifique el `onboardingStatus` del usuario. Si no es `COMPLETED`, solo se permiten rutas de `/onboarding/*`.
2. **Aislamiento (Multi-tenancy):** Todas las consultas de negocio (productos, pedidos, etc.) deben incluir obligatoriamente el filtro `tenantId` en el `WHERE` de la base de datos. El `TenantInterceptor` inyecta `tenantId` automáticamente desde el JWT.
3. **Gestión de Trial:** Un proceso de background (Cron job) debe marcar las suscripciones como `EXPIRED` una vez superada la fecha `trialEndDate`.

## 📱 Flujo Completo de Usuario

```
┌─────────────────────────────────────────────────────────────────────┐
│ REGISTRO TRADICIONAL (Formulario)                                    │
├─────────────────────────────────────────────────────────────────────┤
│ POST /auth/register                                                  │
│   → Crea Tenant + Subscription (TRIAL) + User (con tenantId)        │
│   → Devuelve JWT con tenantId                                         │
│ Login exitoso → ¿tenantId? → SÍ → /dashboard                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ REGISTRO SOCIAL (Google/Facebook)                                    │
├─────────────────────────────────────────────────────────────────────┤
│ GET /auth/google → OAuth → /auth/google/callback                      │
│   → validateOrCreateSocialUser (crea User con tenantId: null)       │
│   → Devuelve JWT con tenantId: null                                   │
│ Login exitoso → ¿tenantId? → NO → /onboarding                        │
│   → Upsert de Tenant (crea si no existe, actualiza si existe)       │
│   → Suscripción TRIAL creada                                         │
│ Onboarding completado → /dashboard                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ MULTI-TENANT                                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Usuario con múltiples tenants → /tenant-selector                     │
│   → GET /auth/my-tenants (lista tenants del usuario)                 │
│   → SELECT tenant → Sesión aktualizada con tenant activo            │
│   → Redirect /dashboard                                               │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 Endpoint de Upsert (Tenant)

**POST /auth/tenant**

```json
// Request
{ "tenantName": "Mi Empresa S.A." }

// Response (creó nuevo)
{
  "tenant": { "id": "uuid", "name": "Mi Empresa S.A." },
  "created": true
}

// Response (actualizó existente)
{
  "tenant": { "id": "uuid", "name": "Mi Empresa S.A." },
  "created": false
}
```

**GET /auth/tenant**

```json
// Response (tiene tenant)
{ "tenant": { "id": "uuid", "name": "Mi Empresa S.A." } }

// Response (no tiene tenant)
{ "tenant": null }
```