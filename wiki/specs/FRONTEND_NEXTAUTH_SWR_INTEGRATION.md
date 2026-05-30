# Integración Frontend: NextAuth + SWR

## Visión General

Este documento describe la integración de NextAuth + SWR implementada en el frontend de la aplicación.

## Arquitectura

### Configuración de NextAuth

**Archivo:** `apps/frontend/app/api/auth/[...nextauth]/route.ts`

- **Credentials Provider:** Recibe `token`, `refreshToken` y `user` desde NestJS.
- **Callback jwt:**
  - Almacena `accessToken`, `refreshToken` y datos del usuario.
  - Verifica expiración del token (decodifica claim `exp`).
  - Si exp < ahora + 5 minutos, llama a `/api/auth/refresh` en NestJS.
  - Actualiza la sesión con nuevos tokens si el refresh es exitoso.
- **Callback session:** Pasa `accessToken` y datos del usuario a la sesión del cliente.
- **Estrategia de sesión:** JWT con edad máxima de 7 días (coincide con el refresh token).

### Página de Callback de Auth

**Archivo:** `apps/frontend/app/auth/callback/page.tsx`

- Extrae `token`, `refresh_token` y `user` de los query params de la URL.
- Usa `signIn('credentials', {...})` en lugar de localStorage.
- Redirige a `/dashboard` o `/onboarding` según `tenantId`.

## Helper fetchWithAuth

**Archivo:** `apps/frontend/lib/auth/fetch-with-auth.ts`

### Funciones

- `fetchWithAuth<T>(url, options, accessToken)`: Fetch autenticado directo.
- `useAuthFetch<T>(url, options)`: Hook SWR con autenticación automática.
- `apiFetch<T>(endpoint, options, accessToken)`: Helper simple de fetch API.

### Uso

```typescript
// Basado en hooks (recomendado para fetching de datos)
const { data, error, isLoading } = useAuthFetch<User[]>('/api/users');

// Fetch directo
const users = await apiFetch<User[]>('/api/users');

// Fetch manual
const users = await fetchWithAuth<User[]>('/api/users', {}, accessToken);
```

### Funcionalidades

- Adjunta automáticamente el header `Authorization: Bearer ***`.
- Maneja errores 401 redirigiendo al login.
- SWR provee revalidación y cacheo automático.
- Intervalos de reintento y refresh configurables.

## SessionProvider

**Archivo:** `apps/frontend/components/providers/next-auth-provider.tsx`

 Envuelve la aplicación con el `SessionProvider` de NextAuth.

**Archivo:** `apps/frontend/app/layout.tsx`

El layout raíz usa `NextAuthProvider`.

## Variables de Entorno

```env
AUTH_SECRET="<secret-para-firmar-jwt>"
NEXTAUTH_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3001"
```

## Estructura de Archivos

```
apps/frontend/
├── app/
│   ├── api/auth/[...nextauth]/route.ts  # Handler de NextAuth
│   ├── auth/
│   │   ├── callback/page.tsx            # Handler de callback OAuth
│   │   ├── login/page.tsx                # Página de login
│   │   └── register/page.tsx            # Página de registro
│   ├── (protected)/                     # Grupo de rutas protegidas
│   │   ├── dashboard/page.tsx
│   │   └── onboarding/page.tsx
│   ├── layout.tsx                       # Layout raíz con SessionProvider
│   └── page.tsx                         # Home redirect
├── components/
│   └── providers/
│       └── next-auth-provider.tsx       # Wrapper de SessionProvider
├── lib/auth/
│   └── fetch-with-auth.ts               # Helper SWR + auth
└── middleware.ts                        # Guards de rutas
```

## Dependencias

```json
{
  "next-auth": "^5.0.0-beta.25",
  "swr": "^2.3.0"
}
```