# Backend — Variables de Entorno

Todas las variables se cargan desde `apps/backend/.env` (basado en `.env.example`).

| Variable                         | Descripción                                                 |
|----------------------------------|-------------------------------------------------------------|
| `NODE_ENV`                       | `development` \| `production` \| `test`.                    |
| `PORT`                           | Puerto HTTP del backend (default `3001`).                   |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` | Conexión PostgreSQL vía TypeORM. |
| `AUTH_SECRET`                    | Debe coincidir con `NEXTAUTH_SECRET` del frontend.          |
| `FRONTEND_URL`                   | URL del frontend (CORS, OAuth callbacks, `back_url` de MP). |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_CALLBACK_URL` | OAuth Google.                                |
| `FACEBOOK_CLIENT_ID` / `_SECRET` / `_CALLBACK_URL` | OAuth Facebook.                              |
| `RESEND_API_KEY` / `FROM_EMAIL`  | Servicio de email transaccional (Resend).                   |
| `MERCADOPAGO_ACCESS_TOKEN`       | Token privado de MercadoPago (sandbox o producción).        |
| `MERCADOPAGO_PUBLIC_KEY`         | Clave pública (no se usa en el flujo link de pago).         |
| `MERCADOPAGO_NOTIFICATION_URL`   | URL pública del webhook (`/api/webhooks/mercadopago`).      |
| `MERCADOPAGO_SANDBOX`            | `true` = sandbox, `false` = producción.                     |
| `MERCADOPAGO_CURRENCY`           | Código de moneda de la cuenta MP (`COP`, `ARS`, …).         |

> Variables eliminadas: `JWT_SECRET` (legacy). Se conserva `AUTH_SECRET`
> como única clave de firma compartida con NextAuth.