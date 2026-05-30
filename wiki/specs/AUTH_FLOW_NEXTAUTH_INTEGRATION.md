# Especificación: Flujo de Autenticación Híbrido NextAuth + NestJS

## 1. Contexto

Este documento describe el flujo de autenticación para `shopify-sync-stores`, específicamente la integración entre NextAuth.js (Frontend) y NestJS (Backend).

**Estado Actual:**
- NestJS gestiona la autenticación por credenciales y social (Google/Facebook) con Passport.js.
- El frontend recibe un JWT mediante parámetros de URL tras el login social y lo almacena en `localStorage`.

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
- **NextAuth (Frontend):**
  - Gestiona el estado de sesión del lado del cliente.
  - Almacena el JWT y Refresh Token de NestJS en una cookie cifrada.
  - Maneja el refresh de tokens automáticamente usando el callback `jwt`.
  - Expone los hooks `useSession` y `signIn`/`signOut` a los componentes React.

### 2.3 Diagrama de Flujo

#### A. Login Social (Google/Facebook)
```
[Usuario] -> [Frontend] "Login con Google"
      -> [NestJS: GET /auth/google]
      -> [Google OAuth]
      -> [NestJS: /auth/google/callback]
         - AuthService.login(user) genera:
           - access_token (JWT, 1h)
           - refresh_token (7d, guardado en DB)
      -> [Redirect: /auth/callback?token=<jwt>&refresh_token=<rt>&user=<json>]
      -> [Frontend: AuthCallbackPage]
         - Llama signIn('credentials', { token, refreshToken, user })
         - NextAuth almacena tokens en cookie de sesión cifrada
      -> [Redirect a /dashboard o /onboarding según tenantId]
```

#### B. Login por Credenciales
```
[Usuario] -> [Frontend] Formulario de Login
      -> [NestJS: POST /auth/login]
         - Valida credenciales
         - Genera access_token + refresh_token
      -> [Frontend recibe { access_token, user }]
      -> [Llama signIn('credentials', { token, refreshToken, user })]
```

#### C. Llamadas API (Rutas Protegidas)
```
[Componente] -> [Hook SWR] -> [Wrapper fetchWithAuth]
      -> [NestJS: /api/ruta-protegida]
         - Header: Authorization: Bearer ***
         - JwtAuthGuard valida el token
      -> [Respuesta 200/401]
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

## 3. Configuración de NextAuth

**Archivo:** `apps/frontend/app/api/auth/[...nextauth]/route.ts`

### 3.1 Proveedores
- **Credentials Provider:** Usado para todos los logins (datos sociales pasados como credentials tras el callback de OAuth).
  - Credentials contienen: `token`, `refreshToken`, `user` (JSON string).

### 3.2 Callbacks
- **jwt:** Intercepta la creación/actualización del token.
  - En Login: Almacena `accessToken`, `refreshToken` y datos del usuario en el JWT de NextAuth.
  - En Actualización: Verifica `accessToken.exp` en cada request. Si expiró o está por expirar, llama al endpoint de refresh del backend.
- **session:** Pasa `accessToken` y datos del usuario al objeto de sesión del cliente accesible vía `useSession()`.

### 3.3 Páginas
- Login personalizado: `/auth/login`
- Error: `/auth/error`

## 4. Cambios en el Backend (NestJS)

### 4.1 Implementación de Refresh Token
- **Entidad:** Agregar tabla `RefreshToken` o columna en la entidad `User` (almacenar hash del token).
- **Servicio:** `AuthService.generateTokens(user)` debe retornar `access_token` y `refresh_token`.
- **Endpoint:** `POST /auth/refresh`
  - Input: `{ refreshToken: string }`
  - Proceso: Busca usuario por hash del token, valida expiración.
  - Output: `{ access_token: string, refresh_token: string }` (opcionalmente con rotación del refresh token).

### 4.2 Actualización de la Entidad User
- Agregar campos para almacenamiento del refresh token (ej. `refreshTokenHash`, `refreshTokenExpiry`).

## 5. Cambios en el Frontend (Next.js)

### 5.1 Configuración de NextAuth
- Instalar `next-auth`.
- Crear `[...nextauth]/route.ts` con `CredentialsProvider`.

### 5.2 Actualización de la Página de Callback de Auth
- **Archivo:** `apps/frontend/app/auth/callback/page.tsx`
- En lugar de `localStorage.setItem('token', ...)`, llamar a `signIn('credentials', ...)`.
- Extraer query params (`token`, `refresh_token`, `user`).

### 5.3 Integración SWR + Auth
- Crear `fetchWithAuth` (wrapper usando SWR o fetch estándar con interceptor).
- **Nota:** `fetchWithAuth` debe consultar `useSession()` para obtener `data?.accessToken`.

## 6. Modelo de Datos

### 6.1 Entidad User (NestJS)
```typescript
@Entity()
export class User {
  // ... campos existentes ...
  @Column({ nullable: true })
  refreshTokenHash: string; // Almacena hash del refresh token
  @Column({ type: 'timestamp', nullable: true })
  refreshTokenExpiresAt: Date;
}
```

## 7. Consideraciones de Seguridad
- **Rotación de Refresh Token:** Idealmente, emitir un nuevo refresh token con cada refresh (rotación) para prevenir ataques de replay.
- **Cookies HttpOnly:** NextAuth usa cookies HttpOnly por defecto para la sesión, lo cual es más seguro que localStorage.
- **CORS:** Asegurar que NestJS tiene CORS configurado para permitir requests desde el dominio de Next.js.

## 8. Preguntas Abiertas / TODOs
1. Implementar rotación de Refresh Token (recomendado).
2. Definir mensajes de error específicos para fallos de refresh en el frontend (ej. "Sesión expirada, por favor inicia sesión nuevamente").
3. Manejar sincronización de sesión en múltiples pestañas (NextAuth lo maneja vía `syncSWR`).