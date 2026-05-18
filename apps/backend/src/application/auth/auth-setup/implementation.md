# Especificación de API: Configuración de Auth e Infraestructura

## Resumen
Configuración de la infraestructura base de autenticación y base de datos utilizando NestJS, TypeORM y PostgreSQL, siguiendo principios de Clean Architecture y SOLID.

## Arquitectura
- **Patrón:** Clean Architecture (Dominio, Aplicación, Infraestructura).
- **Multitenancy:** Discriminación por columna utilizando `tenantId` en todas las entidades dependientes del tenant. Reforzado con `TenantInterceptor` para inyección automática de `tenantId` en peticiones y `OnboardingGuard` para control de acceso basado en el estado del onboarding.
- **Estrategia de Auth:** JWT (JSON Web Tokens) sin estado, compartido entre el Frontend (NextAuth.js v5) y el Backend (NestJS) mediante un `AUTH_SECRET` común.

## Componentes Principales

### 1. Base de Datos (Infraestructura)
- **ORM:** TypeORM.
- **DB:** PostgreSQL.
- **Módulo:** `DatabaseModule` gestiona la conexión asíncrona utilizando variables de entorno.

### 2. Entidades (Dominio)
- `Tenant`: Representa la unidad organizativa de nivel superior.
- `User`: Representa a los usuarios individuales, vinculados a un `Tenant` mediante `tenantId`.
- `Subscription`: Gestiona los planes de suscripción (ej. Trial, Basic, Premium) para cada `Tenant`.
- `Store`: Almacena la información de las tiendas Shopify conectadas por cada `Tenant`.
- `TeamMember`: Gestiona los miembros del equipo asociados a un `Tenant` y `User`.

### 3. Autenticación (Aplicación)
- **Flujo de Login:** 
  1. El cliente envía credenciales a `POST /auth/login` (o utiliza OAuth2).
  2. `AuthService` valida al usuario.
  3. `AuthService` genera un JWT que contiene `sub` (ID de usuario), `email` y `tenantId`.
- **Módulo:** `AuthModule` encapsula la lógica de JWT, el acceso al repositorio de usuarios y la orquestación del flujo de onboarding.

#### 3.1 Autenticación Social (OAuth2)
Para permitir el inicio de sesión mediante proveedores externos (Google, Facebook), se seguirá el siguiente flujo:

1. **Inicio de sesión:** El cliente (Frontend) inicia la solicitud de autenticación con el proveedor.
2. **Redirección:** El proveedor redirige al usuario al endpoint de callback en el Backend.
3. **Validación de Perfil:** El Backend utiliza la estrategia de Passport correspondiente para validar el token del proveedor y obtener el perfil del usuario (email, nombre, etc.).
4. **Gestión de Usuario:** 
   - Se busca el usuario en la base de datos mediante su email.
   - Si el usuario existe, se actualiza su información si es necesario.
   - Si el usuario no existe, se crea un nuevo registro vinculado al `Tenant` correspondiente (o se le solicita al usuario completar el onboarding).
5. **Emisión de Token:*** El `AuthService` genera un JWT estándar (con `sub`, `email`, `tenantId`) y lo devuelve al cliente.

Este flujo asegura que, independientemente del método de entrada, el sistema siempre trabaje con los JWT internos consistentes.

#### 3.2 Flujo de Registro y Onboarding Multitenant (POST /auth/register)
El endpoint `POST /auth/register` ha sido refactorizado para implementar el flujo de onboarding SaaS Multitenant, sin requerir que el cliente envíe el `tenantId`.

**Payload Esperado:**
```json
{
  "name": "string",         // Nombre del usuario
  "email": "string",        // Correo electrónico del usuario (único)
  "password": "string",     // Contraseña del usuario
  "companyName": "string"   // Nombre de la compañía/organización (se usa para el nombre del Tenant)
}
```

**Flujo de Orquestación en `AuthService.register`:**
1.  **Creación del Tenant:** Utiliza `TenantService.create(companyName)` para crear un nuevo `Tenant` en la base de datos.
2.  **Creación de Suscripción (Trial):** Utiliza `SubscriptionService.createTrial(tenantId)` para asociar una suscripción de prueba (Trial) de 14 días al nuevo Tenant.
3.  **Creación del Usuario:** Crea el `User` en la base de datos, vinculándolo al `tenantId` recién creado y estableciendo su `onboardingStatus` inicial en `PENDING_STORE_CONFIG`.

### 4. Seguridad y Aislamiento (Aplicación e Infraestructura)

Para garantizar la integridad y el aislamiento de los datos en el modelo multitenant:

#### 4.1 Onboarding Guard (`OnboardingGuard`)
-   **Función:** Un NestJS Guard que se aplica a las rutas protegidas.
-   **Lógica:** Verifica el `onboardingStatus` del usuario autenticado (extraído del JWT).
    -   Si el `onboardingStatus` no es `COMPLETED`, el acceso a la mayoría de las rutas es denegado (lanza `ForbiddenException`).
    -   Permite el acceso a rutas que coinciden con `/onboarding/*` para que el usuario pueda completar su configuración inicial.

#### 4.2 Interceptor de Tenant (`TenantInterceptor`)
-   **Función:** Un NestJS Interceptor a nivel global.
-   **Lógica:** Extrae el `tenantId` del payload del JWT del usuario autenticado y lo inyecta en el objeto `request` de NestJS. Esto asegura que todos los servicios de la aplicación tengan acceso al `tenantId` actual para filtrar automáticamente las consultas a la base de datos (discriminación por columna).

### 5. Gestión de Suscripciones (Procesos en Background)

#### 5.1 Cron Job de Expiración de Trial (`SubscriptionCron`)
-   **Función:** Un NestJS Cron Job que se ejecuta periódicamente (ej. diariamente).
-   **Lógica:** Revisa todas las suscripciones activas y, si encuentra alguna cuyo `trialEndDate` ya ha pasado, actualiza su `status` a `EXPIRED`.