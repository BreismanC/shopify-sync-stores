# Especificación: Flujo de Autenticación Híbrido NextAuth + NestJS

## 1. Contexto

Este documento describe el flujo de autenticación para `shopify-sync-stores`, específicamente la integración entre NextAuth.js (Frontend) y NestJS (Backend).

**Estado Actual:**

- NestJS gestiona la autenticación por credenciales y social (Google/Facebook) con Passport.js.
- El frontend recibe un JWT tras el login y lo pasa a NextAuth mediante `signIn('credentials')`.
- NextAuth almacena los tokens en cookies cifradas.

**Objetivo:**

- Implementar NextAuth como gestor de sesión del frontend.
- Mantener NestJS como fuente de verdad para autenticación y autorización (emisión y validación de tokens).
- Introducir Refresh Tokens para manejar la expiración del JWT de forma graceful.

## 2. Arquitectura

### 2.1 Gestión de Tokens

- **Access Token (JWT):** Generado por NestJS. Usado para autorización API (`Bearer Token`). Vida corta (1 hora).
- **Refresh Token:** Generado por NestJS. Usado para obtener un nuevo Access Token cuando el actual expira. Vida larga (7 días), almacenado en DB.

### 2.2 Responsabilidades

- **NestJS:**
  - Valida credenciales (email/password) y proveedores sociales (Google/Facebook).
  - Emite JWT y Refresh Tokens.
  - Provee endpoint para refrescar tokens expirados (`/auth/refresh`).
  - Valida el JWT en rutas API protegidas (`@UseGuards(JwtAuthGuard)`).
  - Tiene endpoint `POST /auth/tenant` para upsert de tenant.
  - Tiene endpoint `GET /auth/my-tenants` para listar tenants del usuario.
- **NextAuth (Frontend):**
  - Gestiona el estado de sesión del lado del cliente.
  - Almacena el JWT y Refresh Token de NestJS en una cookie cifrada.
  - Maneja el refresh de tokens automáticamente usando el callback `jwt`.
  - Expone los hooks `useSession` y `signIn`/`signOut` a los componentes React.

### 2.3 Diagrama de Flujo

#### A. Registro Tradicional (Formulario)

```
[Usuario] → [Frontend] Formulario de registro
    → [NestJS: POST /auth/register]
       - AuthService.register() crea: Tenant + Subscription + User
       - Devuelve JWT con tenantId (ya tiene tenant)
    → [Frontend: signIn('credentials', { token, refreshToken, user })]
    → [Redirect: /dashboard] (ya tiene tenant)
```

#### B. Login Social (Google/Facebook)

```
[Usuario] → [Frontend] "Login con Google"
    → [NestJS: GET /auth/google]
    → [Google OAuth]
    → [NestJS: /auth/google/callback]
       - validateOrCreateSocialUser() crea User con tenantId: null
       - AuthService.login(user) genera JWT con tenantId: null
    → [Redirect: /auth/callback?token=<jwt>&user=<json>]
    → [Frontend: AuthCallbackPage]
       - Llama signIn('credentials', { token, refreshToken, user })
       - NextAuth almacena tokens en cookie de sesión cifrada
    → [Redirect: /onboarding] (tenantId es null)
       - En onboarding: usuario ingresa nombre de empresa
       - POST /auth/tenant → Upsert crea Tenant + Subscription
       - Redirect: /dashboard
```

#### C. Login por Credenciales

```
[Usuario] → [Frontend] Formulario de Login
    → [NestJS: POST /auth/login]
       - Valida credenciales con bcrypt
       - Genera access_token + refresh_token
    → [Frontend recibe { access_token, user }]
    → [Llama signIn('credentials', { token, refreshToken, user })]
    → [Redirect según tenantId: /dashboard o /onboarding]
```

#### D. Flujo de Refresh de Token

```
[Verificación de Expiración del JWT]
    - El callback `jwt` de NextAuth decodifica token.exp
    - Si exp < ahora + 5min:
       - Hace fetch a /auth/refresh con refresh_token
       - Si éxito: Actualiza sesión con nuevos tokens
       - Si falla: session.error = "RefreshAccessTokenError"
```

#### E. Selector de Tenant (Multi-Tenant)

```
[Usuario con múltiples tenants]
    → Al login/registro, si tiene más de un tenant
    → [Redirect: /tenant-selector]
       - GET /auth/my-tenants → lista de tenants
       - Usuario selecciona cuál usar
    → POST /auth/tenant/select → actualiza sesión
    → [Redirect: /dashboard]
```

## 3. Configuración de NextAuth

**Archivo:** `apps/frontend/auth.ts`

### 3.1 Proveedores

- **Credentials Provider:** Usado para todos los logins (datos sociales pasados como credentials tras el callback de OAuth).
  - Credentials contienen: `token`, `refreshToken`, `user` (JSON string).

### 3.2 Callbacks

- **jwt:** Intercepta la creación/actualización del token.
  - En Login: Almacena `accessToken`, `refreshToken` y datos del usuario en el JWT de NextAuth.
  - En Actualización: Verifica `accessToken.exp` en cada request. Si expiró o está por expirar, llama al endpoint de refresh del backend.
- **session:** Pasa `accessToken` y datos del usuario (incluyendo `tenantId`) al objeto de sesión del cliente accesible vía `useSession()`.

### 3.3 Páginas

- Login personalizado: `/auth/login`
- Registro: `/auth/register`
- Callback OAuth: `/auth/callback`
- Onboarding: `/onboarding`
- Selector de tenant: `/tenant-selector`
- Error: `/auth/error`

## 4. Cambios en el Backend (NestJS)

### 4.1 Nuevos Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/tenant` | Upsert de tenant (crea si no existe, actualiza si existe) |
| GET | `/auth/tenant` | Obtiene el tenant actual del usuario autenticado |
| GET | `/auth/my-tenants` | Lista todos los tenants del usuario |
| POST | `/auth/tenant/select` | Selecciona un tenant como activo |

### 4.2 Validación de Tenant en Login

El `AuthService.login()` ahora devuelve `tenantId` en el payload del JWT, permitiendo que el frontend determine la redirección correcta.

## 5. Cambios en el Frontend (Next.js)

### 5.1 Flujo de Redirect

El frontend determina la redirección basándose en `session.user.tenantId`:

```typescript
// En LoginForm.tsx y AuthCallback
const redirectUrl = result.user?.tenantId 
  ? (result.user.hasMoreTenants ? '/tenant-selector' : '/dashboard')
  : '/onboarding';
```

### 5.2 Página de Onboarding

- Convertida a componente cliente ("use client") para manejar el estado del form.
- Al cargar, consulta `GET /auth/tenant` para obtener el tenant existente.
- Si el usuario ya tiene tenant: muestra el nombre pre-poblado (editable).
- Si el usuario no tiene tenant: campo vacío para ingresar nombre.
- Al guardar: `POST /auth/tenant` con `{ tenantName }`.

### 5.3 Página de Selector de Tenant

- Nueva página `/tenant-selector` para usuarios con múltiples tenants.
- Consulta `GET /auth/tenant` para obtener la lista de tenants.
- Permite seleccionar cuál tenant usar y guarda la selección.

## 6. Consideraciones de Seguridad

- **Cookies HttpOnly:** NextAuth usa cookies HttpOnly por defecto para la sesión, lo cual es más seguro que localStorage.
- **CORS:** NestJS tiene CORS configurado para permitir requests desde el dominio de Next.js.
- **Tenant Isolation:** El `TenantInterceptor` inyecta `tenantId` en las requests basadas en el JWT, garantizando aislamiento de datos.

## 7. Preguntas Abiertas / TODOs

1. Implementar rotación de Refresh Token (recomendado).
2. Definir mensajes de error específicos para fallos de refresh en el frontend (ej. "Sesión expirada, por favor inicia sesión nuevamente").
3. Manejar sincronización de sesión en múltiples pestañas (NextAuth lo maneja vía `syncSWR`).