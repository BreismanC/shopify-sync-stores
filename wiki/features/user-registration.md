# Especificación de Funcionalidad: Registro de Usuario

## 1. Descripción

Permitir que nuevos usuarios se unan a la plataforma de tres maneras distintas: mediante un formulario tradicional (Email/Password), a través de Google OAuth2, o a través de Facebook OAuth2. El objetivo es minimizar la fricción en el onboarding.

## 2. Datos Requeridos

### 2.1 Registro mediante Formulario (Email/Password)

- **Nombre de la Empresa (Obligatorio):** `companyName` (string). Se usa como nombre del Tenant.
- **Nombre Completo (Obligatorio):** `name` (string).
- **Correo Electrónico (Obligatorio):** `email` (string, único).
- **Contraseña (Obligatorio):** `password` (string, debe ser hasheada).

### 2.2 Registro mediante Proveedores Sociales (Google/Facebook)

- **Nombre Completo:** Obtenido del perfil del proveedor (`name`).
- **Correo Electrónico:** Obtenido del perfil del proveedor (`email`).
- **Nombre de la Empresa:** *Se completa en el onboarding*. El usuario social se crea con `tenantId: null`.
- **Contraseña:** No requerida (se maneja la autenticación con el proveedor).

## 3. Flujos de Trabajo

### 3.1 Flujo de Registro Tradicional

1. El usuario envía los datos al endpoint `POST /auth/register`.
2. El sistema valida que el email no esté registrado.
3. Se crea un nuevo `Tenant` con el `companyName` proporcionado.
4. Se crea una `Subscription` de tipo TRIAL para el Tenant.
5. Se hashea la contraseña.
6. Se crea el registro del `User` vinculado al `Tenant` recién creado.
7. Se devuelve un JWT de acceso con `tenantId` en el payload.
8. El frontend redirige al usuario a `/dashboard` (ya tiene tenant).

### 3.2 Flujo de Registro Social (Google/Facebook)

1. El usuario inicia el flujo de OAuth con el proveedor.
2. El proveedor redirige al backend con un token/perfil.
3. El backend busca al usuario por email:
   - **Si existe:** Se actualizan sus datos (nombre) y se inicia sesión.
   - **Si no existe:** Se crea un nuevo usuario con `tenantId: null` (sin crear Tenant automáticamente).
4. El backend devuelve el JWT con `tenantId: null`.
5. El frontend redirige al usuario a `/onboarding` (no tiene tenant aún).
6. En el onboarding, el usuario debe ingresar el nombre de su empresa (upsert del Tenant).

## 4. Onboarding Multi-Step (Post-Registro)

El onboarding es un flujo de 4 pasos que el usuario debe completar para poder usar la plataforma:

### Paso 1: Configurar Empresa (Upsert de Tenant)

- **Acción:** El usuario ingresa o confirma el nombre de su empresa.
- **Backend:** 
  - Si el usuario no tiene `tenantId`: Crea un nuevo `Tenant` y lo asigna al usuario.
  - Si el usuario ya tiene `tenantId`: Actualiza el nombre del `Tenant` existente.
  - Se crea/actualiza la `Subscription` de tipo TRIAL.
- **Estado de Configuración:** `PENDING_STORE_CONFIG` → `PENDING_STORE_ROLE`

### Paso 2: Conectar Tienda Shopify

- **Acción:** El usuario agrega su tienda Shopify y las credenciales de API.
- **Backend:** Crea la entidad `Store` vinculada al `tenantId`.
- **Estado de Configuración:** `PENDING_STORE_ROLE` → `PENDING_TEAM_CONFIG`

### Paso 3: Configurar Equipo (Opcional)

- **Acción:** El usuario invita a otros miembros por email.
- **Backend:** Crea registros en `TeamMember` y envía invitaciones.
- **Estado de Configuración:** `PENDING_TEAM_CONFIG` → `COMPLETED`

### Paso 4: Iniciar Sincronización

- **Acción:** El usuario lanza su primera sincronización y monitorea el progreso.
- **Estado de Configuración:** `COMPLETED`

## 5. Lógica de Redirección Post-Auth

| Método de Login | ¿Tiene Tenant? | Redirección |
|-----------------|-----------------|-------------|
| Formulario (Email/Password) | Sí (creado en register) | `/dashboard` |
| Google OAuth | No (creado con `tenantId: null`) | `/onboarding` |
| Facebook OAuth | No (creado con `tenantId: null`) | `/onboarding` |

## 6. Selector de Tenant (Multi-Tenant)

Un usuario puede tener acceso a múltiples tenants (ej: administra 2 empresas). El flujo es:

1. Al iniciar sesión, si el usuario tiene más de un `tenantId`, se muestra la página `/tenant-selector`.
2. El usuario selecciona con cuál tenant desea trabajar.
3. La selección se guarda en la sesión y se redirige a `/dashboard`.

## 7. Endpoints de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registro tradicional (crea Tenant + User) |
| POST | `/auth/login` | Login por credenciales |
| GET | `/auth/google` | Inicio de flujo Google OAuth |
| GET | `/auth/google/callback` | Callback de Google OAuth |
| GET | `/auth/facebook` | Inicio de flujo Facebook OAuth |
| GET | `/auth/facebook/callback` | Callback de Facebook OAuth |
| GET | `/auth/my-tenants` | Obtener todos los tenants del usuario |
| POST | `/auth/tenant` | Crear o actualizar tenant (upsert) |
| GET | `/auth/tenant` | Obtener tenant actual del usuario |
| POST | `/auth/tenant/select` | Seleccionar un tenant activo |

## 8. Notas de Implementación

- El campo `User.tenantId` es `nullable: true` para permitir usuarios sin tenant (sociales).
- El `TenantInterceptor` inyecta `tenantId` en las requests basadas en el JWT.
- La relación `User → Tenant` es `ManyToOne` con `nullable: true`.
- El upsert de tenant se realiza en el onboarding, no en el registro social.