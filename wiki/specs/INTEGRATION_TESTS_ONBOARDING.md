# Tests de Integración Sugeridos — Onboarding Multi-Step

> Esta es una **guía de tests** que deberían escribirse. No se incluyen tests
> automatizados en esta fase; el foco está en el comportamiento end-to-end
> del flujo de onboarding.
>
> Los tests unitarios existentes (12 suites, 83 tests) cubren la lógica de
> cada servicio individualmente. Estos tests de integración son el siguiente
> nivel.

## Stack recomendado

- **Backend**: `supertest` + `jest` (igual que los tests existentes, apuntando
  a un NestJS app instance, sin necesidad de levantar el server real).
- **Frontend**: `@testing-library/react` para componentes, `next-auth` mockeado
  con `next-auth/react` test utils.
- **E2E (opcional)**: Playwright con un PostgreSQL de testing descartable.

## Test plan: Backend (supertest + NestJS)

### OnboardingController

| # | Test | Setup | Expectativa |
|---|------|-------|------------|
| 1 | `POST /api/onboarding/tenant` con `PENDING_TENANT_CONFIG` | User con status PENDING_TENANT_CONFIG | 200, devuelve tenant + onboardingStatus=PENDING_PLAN_SELECTION |
| 2 | `POST /api/onboarding/tenant` con `PENDING_STORE_CONFIG` | User con status PENDING_STORE_CONFIG | 409, mensaje "estado inválido" |
| 3 | `POST /api/onboarding/tenant` con `name=''` | - | 400, error de class-validator |
| 4 | `POST /api/onboarding/tenant` con `name='a'` | - | 400 (min length 3) |
| 5 | `GET /api/onboarding/tenant` con `PENDING_PLAN_SELECTION` y tenant existente | - | 200, devuelve el tenant (no null) |
| 6 | `GET /api/onboarding/tenant` con `PENDING_TENANT_CONFIG` y sin tenant | User sin tenant | 200, tenant: null |
| 7 | `GET /api/onboarding/plans` | - | 200, planes BASIC/PRO/ENTERPRISE |

### Step 2 (Plan)

| # | Test | Expectativa |
|---|------|------------|
| 8 | `POST /api/onboarding/preference` con `PENDING_PLAN_SELECTION` y planType=BASIC | Devuelve `{ preferenceId, initPoint, onboardingStatus }`. La subscription queda en PENDING_PAYMENT. |
| 9 | `POST /api/onboarding/preference` con planType=TRIAL | 400, "no se puede crear preference para plan TRIAL" |
| 10 | `POST /api/onboarding/preference` con user en `PENDING_STORE_CONFIG` | 409, estado inválido |
| 11 | `POST /api/onboarding/subscription/skip` con `PENDING_PLAN_SELECTION` y sin subscription | Crea subscription TRIAL 7d, transiciona a PENDING_STORE_CONFIG |
| 12 | `POST /api/onboarding/subscription/skip` con `PENDING_PLAN_SELECTION` y subscription TRIAL existente | Mantiene la subscription, transiciona |

### Step 3 (Store)

| # | Test | Expectativa |
|---|------|------------|
| 13 | `POST /api/onboarding/store/connect` con `PENDING_STORE_CONFIG` y `shopifyShopUrl='mi-tienda.myshopify.com'` | Cifra el token, guarda Store, transiciona a PENDING_STORE_ROLE |
| 14 | `POST /api/onboarding/store/connect` con `shopifyShopUrl` ya usada por otro tenant | 409, "tienda ya está conectada a otro tenant" |
| 15 | `GET /api/onboarding/store/status` con `PENDING_STORE_CONFIG` y sin store | store: null |
| 16 | Token Shopify sin `myshopify.com` | 400 |

### Step 4 (Role)

| # | Test | Expectativa |
|---|------|------------|
| 17 | `POST /api/onboarding/store/role` con storeId inválido | 404, "tienda no encontrada" |
| 18 | `POST /api/onboarding/store/role` con role=VENDOR | Guarda, transiciona a PENDING_TEAM_CONFIG |
| 19 | `POST /api/onboarding/store/role` con role='OTHER' | 400 (IsEnum) |

### Step 5 (Team) + TeamInvitationService

| # | Test | Expectativa |
|---|------|------------|
| 20 | `POST /api/onboarding/team/invite` con email duplicado en el mismo tenant | 409, "ya es miembro activo" |
| 21 | `POST /api/onboarding/team/invite` con email nuevo | 201, crea invitación con token de 64 chars hex y expiresAt en 24h |
| 22 | `POST /api/onboarding/team/invite` reusa invitación PENDING existente | Devuelve invitación con nuevo token |
| 23 | `GET /api/auth/team-invitation/:token` con token válido | 200, datos de la invitación (sin token) |
| 24 | `GET /api/auth/team-invitation/:token` con token expirado | 200, `{ valid: false, reason: 'expired' }` |
| 25 | `GET /api/auth/team-invitation/:token` con token ya aceptado | 200, `{ valid: false, reason: 'already_accepted' }` |
| 26 | `POST /api/auth/team-invitation/accept` con token válido y password=6+ chars | 200, crea User+TeamMember, marca invitación ACCEPTED |
| 27 | `POST /api/auth/team-invitation/accept` con user que ya existe en otro tenant | 409, "registrado con otro tenant" |
| 28 | `POST /api/auth/team-invitation/accept` con token expirado | 400, marca la invitación como EXPIRED |
| 29 | `POST /api/auth/team-invitation/accept` con `password='123'` | 400, "min 6 caracteres" |
| 30 | `DELETE /api/onboarding/team/:id` con invitación PENDING | Marca REVOKED |
| 31 | `DELETE /api/onboarding/team/:id` con invitación ya aceptada | 400 |
| 32 | `TeamInvitationService.expireOld()` con 3 invitaciones PENDING expiradas | Las 3 se marcan como EXPIRED, devuelve 3 |

### Complete

| # | Test | Expectativa |
|---|------|------------|
| 33 | `POST /api/onboarding/complete` con `PENDING_TEAM_CONFIG` y tenant | Marca user COMPLETED, tenant ACTIVE, devuelve onboardingStatus |
| 34 | `POST /api/onboarding/complete` con `PENDING_STORE_CONFIG` | 409 |
| 35 | `POST /api/onboarding/complete` con user sin tenant | 400 |

### MercadoPago Webhook

| # | Test | Expectativa |
|---|------|------------|
| 36 | `POST /api/webhooks/mercadopago` con `type=preapproval` y `data.id=<valid_id>` | El service hace GET a MP (mocked), si status=active transiciona al user, devuelve 200 |
| 37 | `POST /api/webhooks/mercadopago` con `type=payment` | El service procesa handlePaymentEvent, devuelve 200 |
| 38 | `POST /api/webhooks/mercadopago` con firma inválida | 400 |
| 39 | `POST /api/webhooks/mercadopago` con `type=unknown` | 200, log warning, no procesa nada |
| 40 | `POST /api/webhooks/mercadopago` con `preapproval` status=cancelled | Marca subscription CANCELED, no transiciona al user |
| 41 | Mock de MP devuelve 500 | El webhook responde 500 (MP reintentará) |

### OnboardingGuard

| # | Test | Expectativa |
|---|------|------------|
| 42 | User con onboardingStatus=COMPLETED accediendo a `/api/products` | Allow |
| 43 | User con onboardingStatus=PENDING_STORE_CONFIG accediendo a `/api/products` | 403 con `error: 'ONBOARDING_REQUIRED'` y `onboardingStatus: PENDING_STORE_CONFIG` |
| 44 | User con onboardingStatus=PENDING_STORE_CONFIG accediendo a `/api/onboarding/store/connect` | Allow (ruta exenta) |
| 45 | User con onboardingStatus=PENDING_STORE_CONFIG accediendo a `/api/webhooks/mercadopago` | Allow (ruta exenta) |
| 46 | User con onboardingStatus=PENDING_STORE_CONFIG accediendo a `/api/auth/refresh` | Allow (ruta exenta) |
| 47 | Sin user (request.user undefined) | Deny |

## Test plan: Frontend (Testing Library)

### proxy.ts (middleware)

Estos tests requieren un build de Next.js. Más fácil hacerlos con un mock
del proxy y testear la función pura.

| # | Test | Expectativa |
|---|------|------------|
| F1 | Sin sesión, ruta `/dashboard` | redirect a `/auth/login?callbackUrl=/dashboard` |
| F2 | Sin sesión, ruta `/` | Allow (pública) |
| F3 | Con sesión, onboardingStatus=COMPLETED, ruta `/dashboard` | Allow |
| F4 | Con sesión, onboardingStatus=PENDING_TENANT_CONFIG, ruta `/dashboard` | redirect a `/onboarding` |
| F5 | Con sesión, onboardingStatus=PENDING_STORE_CONFIG, ruta `/onboarding?step=5` | redirect a `/onboarding?step=3` |
| F6 | Con sesión, onboardingStatus=PENDING_STORE_CONFIG, ruta `/onboarding?step=2` | redirect a `/onboarding?step=3` |
| F7 | Con sesión, onboardingStatus=COMPLETED, ruta `/auth/login` | redirect a `/dashboard` |
| F8 | Con sesión, onboardingStatus=COMPLETED, ruta `/onboarding/summary` | Allow (sin redirect a dashboard) — porque el summary es un caso especial post-completion? Decidir. |

### Componentes de Onboarding

| # | Test | Expectativa |
|---|------|------------|
| F9 | `<Step1Company>` con tenant pre-existente | Muestra nombre actual en el input, label "Actualizar y continuar" |
| F10 | `<Step1Company>` click submit con `name='ab'` | Toast de error, no llama a la API |
| F11 | `<Step2Plan>` render | Muestra 3 planes, "Saltar" y "Pagar" disabled hasta seleccionar |
| F12 | `<Step2Plan>` click "Saltar" | Llama `POST /api/onboarding/subscription/skip`, navega a `?step=3` |
| F13 | `<Step3Store>` con `shopifyShopUrl='mi-tienda.myshopify.com'` y `accessToken='shpat_abc123'` | Submit OK, navega a `?step=4` |
| F14 | `<Step4Role>` click SOURCE → continuar | Submit OK, navega a `?step=5` |
| F15 | `<Step5Team>` agregar email y submit | Llama `POST /team/invite`, muestra en la lista |
| F16 | `<OnboardingSummary>` click "Confirmar" | Llama `POST /onboarding/complete`, navega a `/dashboard` |

### LoginForm / callback redirect

| # | Test | Expectativa |
|---|------|------------|
| F17 | `LoginForm` con `result.user.onboardingStatus=PENDING_TENANT_CONFIG` | `window.location.href = '/onboarding?step=1'` |
| F18 | `LoginForm` con `result.user.onboardingStatus=COMPLETED` y 1 tenant | `window.location.href = '/dashboard'` |
| F19 | `LoginForm` con `result.user.onboardingStatus=COMPLETED` y 3 tenants | `window.location.href = '/tenant-selector'` |
| F20 | `AuthCallback` con `user.onboardingStatus=COMPLETED` | (idem F18) |

## Test plan: E2E (Playwright, opcional)

Si se implementa en el futuro, estos son los flujos críticos:

```
escenarios/e2e/
├── 01-registro-y-onboarding-completo.spec.ts
│   - Registrar user → onboarding step 1 → step 2 (skip) → step 3 → step 4 → step 5 → summary → dashboard
│   - Verificar que el dashboard es accesible solo después de COMPLETED
│
├── 02-registro-social-sin-tenant.spec.ts
│   - Login con Google mockeado → onboarding step 1 con input vacío
│   - Skip plan → store → role → team → summary → dashboard
│
├── 03-abandono-y-retoma.spec.ts
│   - Login, completar step 1, cerrar sesión
│   - Login de nuevo → debe aterrizar en /onboarding?step=2
│
├── 04-salto-de-paso-bloqueado.spec.ts
│   - Login, completar step 1, intentar ir a /onboarding?step=5
│   - Debe redirigir a /onboarding?step=2
│
├── 05-proteccion-dashboard.spec.ts
│   - User en PENDING_STORE_CONFIG accede a /dashboard
│   - Debe redirigir a /onboarding?step=3
│
├── 06-flujo-pago-mp.spec.ts
│   - Login, completar step 1
│   - Step 2: seleccionar plan → click pagar → MP sandbox → completar pago → webhook
│   - Verificar que transiciona a step 3
│
├── 07-invitacion-equipo-completa.spec.ts
│   - User A: step 5 → invitar userB@ejemplo.com → revisar email (Mailhog/Mailtrap)
│   - User B: click link → aceptar → crear password → ver dashboard
│
└── 08-invitacion-expirada.spec.ts
    - Crear invitación → esperar 24h (mockear tiempo) → aceptar → 400 expired
```

## Cómo correrlos (cuando se escriban)

```bash
# Backend unit + integration
pnpm --filter backend test

# Backend con cobertura
pnpm --filter backend test:cov

# Frontend con Testing Library
pnpm --filter frontend test

# E2E (cuando exista)
pnpm --filter e2e test
```

## Notas

- Los tests del webhook de MP requieren mockear `MercadoPagoService` (interceptar
  `fetch` con `nock` o `jest-fetch-mock`).
- Para los tests de email, considerar `Mailhog` o `Mailtrap` y aserciones sobre
  el cuerpo del correo.
- Los tests de expiración de invitaciones se aceleran mockeando `Date.now()` o
  seteando `expiresAt` a una fecha pasada manualmente.
- Para tests de middleware en Next.js 16 (`proxy.ts`), considerar extraer la
  lógica a una función pura testeable con `createMocks` de `next/navigation`.
