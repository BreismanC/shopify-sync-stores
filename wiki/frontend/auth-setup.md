# Configuración de Autenticación del Frontend (NextAuth v5)

## Visión General
NextAuth v5 (beta) gestiona las sesiones del frontend usando estrategia JWT. El frontend actúa como orquestador de sesiones mientras el backend (NestJS) valida credenciales y emite tokens.

## Arquitectura

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│ Navegador    │ ──────► │  Next.js (3000)  │ ──────► │  NestJS (3001) │
│   Cliente    │ ◄────── │  NextAuth v5     │ ◄────── │  Auth Service │
└──────────────┘         └──────────────────┘         └──────────────┘
     │                           │
     │  1. POST /auth/login       │
     │  2. /api/auth/signin       │
     │  3. signIn() server-side   │
     │  ◄─── JWT + User ─────────│
```

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `auth.ts` | Configuración de NextAuth con providers Credentials + Google/Facebook |
| `middleware.ts` | Guards de rutas: segmentación público/protegido |
| `app/api/auth/signin/route.ts` | Proxy server-side de `signIn()` (soluciona problemas de CSRF/cookies) |
| `app/auth/login/LoginForm.tsx` | Formulario de login que llama a `/api/auth/signin` |
| `app/auth/register/RegisterForm.tsx` | Formulario de registro que llama a `/api/auth/signin` |
| `app/auth/callback/page.tsx` | Handler de callback OAuth (extrae `token` + `user` de la URL) |
| `app/(protected)/` | Grupo de rutas para páginas autenticadas (dashboard, onboarding) |

## Configuración de Rutas (middleware.ts)

### Rutas Públicas (sin auth requerida)
- `/` — Página de inicio
- `/auth/login` — Página de login
- `/auth/register` — Página de registro
- `/auth/error` — Página de error de auth
- `/api/auth/*` — Rutas API de NextAuth

### Rutas Protegidas (requiere auth)
- `/dashboard`
- `/onboarding`
- `/settings`
- `/stores`
- `/products`
- `/orders`

### Lógica del Middleware

```typescript
// No autenticado → ruta protegida → redirigir a /auth/login?callbackUrl=...
if (isProtectedRoute && !isLoggedIn) {
  return NextResponse.redirect(loginUrl);
}

// Autenticado → /auth/* → redirigir a /dashboard
if (isLoggedIn && pathname.startsWith('/auth/')) {
  return NextResponse.redirect(new URL('/dashboard', req.url));
}
```

## Flujo de Sesión

### Flujo de Credenciales (Email/Contraseña)
1. Usuario envía formulario → `POST /api/auth/signin`
2. La ruta API llama `signIn('credentials', { email, password, redirect: false })` **server-side**
3. NextAuth invoca NestJS `/auth/login` → valida → retorna JWT
4. El JWT se almacena en la cookie de sesión (`AUTH_SECRET` lo firma)
5. El middleware lee la sesión vía `req.auth`

### Flujo OAuth (Google/Facebook)
1. Usuario clickea proveedor → `GET /auth/google` o `GET /auth/facebook`
2. NestJS redirige a la URL OAuth del proveedor
3. El proveedor redirige de vuelta a `GET /auth/google/callback` o `GET /auth/facebook/callback`
4. NestJS valida, genera JWT, redirige a frontend `/auth/callback?token=...&user=...`
5. `CallbackPage` extrae `token` y `user` de la URL, llama `signIn('credentials', { token, user })`
6. NextAuth almacena JWT en la cookie de sesión

## Variables de Entorno

```env
AUTH_SECRET="<secret-aleatorio-para-firmar-jwt>"
NEXTAUTH_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3001"
```

## Checklist de Pruebas

- [ ] Navegar a `/auth/register` sin estar logueado → carga normalmente
- [ ] Iniciar sesión → redirige a `/dashboard`
- [ ] Navegar a `/auth/register` estando logueado → redirige a `/dashboard`
- [ ] Navegar a `/dashboard` sin estar logueado → redirige a `/auth/login?callbackUrl=/dashboard`
- [ ] Login con Google OAuth completa y llega al dashboard
- [ ] Sin errores de consola en ninguna página