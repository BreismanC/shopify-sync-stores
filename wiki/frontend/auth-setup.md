# Frontend Authentication Setup (NextAuth v5)

## Overview
NextAuth v5 (beta) manages frontend sessions using JWT strategy. The frontend acts as the session orchestrator while the backend (NestJS) validates credentials and issues tokens.

## Architecture

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Browser    │ ──────► │  Next.js (3000)  │ ──────► │  NestJS (3001) │
│   Client     │ ◄────── │  NextAuth v5     │ ◄────── │  Auth Service │
└──────────────┘         └──────────────────┘         └──────────────┘
     │                           │
     │  1. POST /auth/login      │
     │  2. /api/auth/signin      │
     │  3. signIn() server-side  │
     │  ◄─── JWT + User ─────────│
```

## Key Files

| File | Purpose |
|------|---------|
| `auth.ts` | NextAuth configuration with Credentials + Google/Facebook providers |
| `middleware.ts` | Route guards: public/protected segmentation |
| `app/api/auth/signin/route.ts` | Server-side `signIn()` proxy (fixes CSRF/cookie issues) |
| `app/auth/login/LoginForm.tsx` | Login form calling `/api/auth/signin` |
| `app/auth/register/RegisterForm.tsx` | Registration form calling `/api/auth/signin` |
| `app/auth/callback/page.tsx` | OAuth callback handler (extracts `token` + `user` from URL) |
| `app/(protected)/` | Route group for authenticated pages (dashboard, onboarding) |

## Route Configuration (middleware.ts)

### Public Routes (no auth required)
- `/` — Landing page
- `/auth/login` — Login page
- `/auth/register` — Registration page
- `/auth/error` — Auth error page
- `/api/auth/*` — NextAuth API routes

### Protected Routes (auth required)
- `/dashboard`
- `/onboarding`
- `/settings`
- `/stores`
- `/products`
- `/orders`

### Middleware Logic

```typescript
// Unauthenticated → protected route → redirect to /auth/login?callbackUrl=...
if (isProtectedRoute && !isLoggedIn) {
  return NextResponse.redirect(loginUrl);
}

// Authenticated → /auth/* → redirect to /dashboard
if (isLoggedIn && pathname.startsWith('/auth/')) {
  return NextResponse.redirect(new URL('/dashboard', req.url));
}
```

## Session Flow

### Credentials Flow (Email/Password)
1. User submits form → `POST /api/auth/signin`
2. API route calls `signIn('credentials', { email, password, redirect: false })` **server-side**
3. NextAuth invokes NestJS `/auth/login` → validates → returns JWT
4. JWT stored in session cookie (`AUTH_SECRET` signs it)
5. Middleware reads session via `req.auth`

### OAuth Flow (Google/Facebook)
1. User clicks provider → `GET /auth/google` or `GET /auth/facebook`
2. NestJS redirects to provider's OAuth URL
3. Provider redirects back to `GET /auth/google/callback` or `GET /auth/facebook/callback`
4. NestJS validates, generates JWT, redirects to frontend `/auth/callback?token=...&user=...`
5. `CallbackPage` extracts `token` and `user` from URL, calls `signIn('credentials', { token, user })`
6. NextAuth stores JWT in session cookie

## Environment Variables

```env
AUTH_SECRET="<random-secret-for-jwt-signing>"
NEXTAUTH_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3001"
```

## Testing Checklist

- [ ] Navigate to `/auth/register` while logged out → loads normally
- [ ] Log in → redirect to `/dashboard`
- [ ] Navigate to `/auth/register` while logged in → redirect to `/dashboard`
- [ ] Navigate to `/dashboard` while logged out → redirect to `/auth/login?callbackUrl=/dashboard`
- [ ] OAuth Google login completes and lands on dashboard
- [ ] No console errors on any page