# Frontend — Variables de Entorno

## Convención única

| Variable              | Ámbito                          | Descripción                                              |
|-----------------------|---------------------------------|----------------------------------------------------------|
| `NEXTAUTH_SECRET`     | server                          | Secreto HMAC para firmar el JWT de NextAuth.            |
| `NEXTAUTH_URL`        | server / client                 | URL pública del frontend (callback OAuth, redirecciones).|
| `NEXT_PUBLIC_API_URL` | server / client                 | URL del backend NestJS (usada por código cliente y server). |

> Antes existían `BACKEND_URL` y `NEXT_PUBLIC_BACKEND_URL` duplicadas. **Se eliminaron**:
> toda referencia se resuelve ahora desde `NEXT_PUBLIC_API_URL` a través de
> `apps/frontend/lib/env.ts` (`getBackendUrl()`), con fallback a `http://localhost:3001`.

## Uso

```ts
import { BACKEND_URL } from '@/lib/env';

// Server route handler, server action, o componente cliente
const res = await fetch(`${BACKEND_URL}/api/auth/login`, { ... });
```

No usar `process.env.BACKEND_URL` ni `process.env.NEXT_PUBLIC_API_URL` directamente.