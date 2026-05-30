# Frontend NextAuth + SWR Integration

## Overview

This document describes the NextAuth + SWR integration implemented in the frontend application.

## Architecture

### NextAuth Configuration

**File:** `apps/frontend/app/api/auth/[...nextauth]/route.ts`

- **Credentials Provider:** Receives `token`, `refreshToken`, and `user` from NestJS
- **JWT Callback:** 
  - Stores `accessToken`, `refreshToken`, and user data
  - Checks token expiration (decodes `exp` claim)
  - If exp < now + 5 minutes, calls `/api/auth/refresh` on NestJS
  - Updates session with new tokens on refresh success
- **Session Callback:** Passes `accessToken` and user data to client session
- **Session Strategy:** JWT with 7-day max age (matches refresh token)

### Auth Callback Page

**File:** `apps/frontend/app/auth/callback/page.tsx`

- Extracts `token`, `refresh_token`, and `user` from URL query params
- Uses `signIn('credentials', {...})` instead of localStorage
- Redirects to `/dashboard` or `/onboarding` based on `tenantId`

## fetchWithAuth Helper

**File:** `apps/frontend/lib/auth/fetch-with-auth.ts`

### Functions

- `fetchWithAuth<T>(url, options, accessToken)`: Direct authenticated fetch
- `useAuthFetch<T>(url, options)`: SWR hook with automatic auth
- `apiFetch<T>(endpoint, options, accessToken)`: Simple API fetch helper

### Usage

```typescript
// Hook-based (recommended for data fetching)
const { data, error, isLoading } = useAuthFetch<User[]>('/api/users');

// Direct fetch
const users = await apiFetch<User[]>('/api/users');

// Manual fetch
const users = await fetchWithAuth<User[]>('/api/users', {}, accessToken);
```

### Features

- Automatically attaches `Authorization: Bearer <token>` header
- Handles 401 errors by redirecting to login
- SWR provides automatic revalidation and caching
- Configurable retry and refresh intervals

## SessionProvider

**File:** `apps/frontend/components/providers/next-auth-provider.tsx`

Wraps the application with NextAuth's `SessionProvider`.

**File:** `apps/frontend/app/layout.tsx`

Root layout uses `NextAuthProvider`.

## Environment Variables

```env
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## File Structure

```
apps/frontend/
├── app/
│   ├── api/auth/[...nextauth]/route.ts  # NextAuth handler
│   ├── auth/callback/page.tsx            # OAuth callback handler
│   ├── layout.tsx                        # Root layout with SessionProvider
│   └── page.tsx                          # Home redirect
├── components/
│   └── providers/
│       └── next-auth-provider.tsx        # SessionProvider wrapper
├── lib/auth/
│   ├── fetch-with-auth.ts                # SWR + auth helper
│   └── index.ts                          # Exports
└── package.json
```

## Dependencies

```json
{
  "next-auth": "^5.0.0-beta.25",
  "swr": "^2.3.0",
  "jose": "^6.0.0"
}
```
