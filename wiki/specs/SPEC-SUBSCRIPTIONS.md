# Módulo de Suscripciones — Especificación Técnica v2.0

> **Estado del documento:** En desarrollo (actualizado June 2026)
> **Proyecto:** shopify-sync-stored
> **Stack:** NestJS (backend:3001) + Next.js 16 (frontend:3000) + Turborepo

---

## 1. Visión General y Arquitectura

El módulo de suscripciones gestiona el ciclo de vida de los planes SaaS. Cada tenant tiene una suscripción activa desde el momento de su creación (plan FREE por defecto). El usuario puede hacer upgrade a PRO o ENTERPRISE via MercadoPago.

### Flujo de onboarding (wizard de 4 pasos)

```
Step 1          Step 2              Step 3          Step 4
┌─────────┐     ┌─────────────┐     ┌──────────┐   ┌──────────────┐
│ Tenant  │────▶│ Shopify    │────▶│ Plan     │──▶│ Payment     │
│ Create  │     │ Store      │     │ Selection│   │ (MercadoPago)│
└─────────┘     └─────────────┘     └──────────┘   └──────────────┘
  POST /api/    POST /api/        GET /plans      POST /preference
  auth/tenant   stores/sync       POST /subscribe
  upsert                        (upgrade FREE→PRO)
```

### Modelo de datos

#### Tenant
```typescript
{
  id: UUID (PK)
  name: string           // nombre de la empresa (min 3 chars)
  ownerId: UUID (FK)     // usuario que creó el tenant
  createdAt: Date
  updatedAt: Date
}
```

#### Subscription (se crea automáticamente al crear el Tenant)
```typescript
{
  id: UUID (PK)
  tenantId: UUID (FK → Tenant, UNIQUE)
  planType: Enum ['FREE', 'PRO', 'ENTERPRISE']  // default: 'FREE'
  status: Enum ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIAL']
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: Boolean  // default: false
  mercadopagoSubscriptionId?: string  // MP pre-approval ID
  createdAt: Date
  updatedAt: Date
}
```

#### Plan (Value Object — hardcodeado, no en DB)
```typescript
const PLANS = {
  FREE: {
    name: 'Free',
    monthlyPrice: 0,
    stores: 1,
    teamMembers: 1,
    syncOpsPerDay: 100,
    storageGB: 1,
    webhooks: 2,
    support: 'email'
  },
  PRO: {
    name: 'Pro',
    monthlyPrice: 29,          // USD $29/mes
    stores: 5,
    teamMembers: 5,
    syncOpsPerDay: 5000,
    storageGB: 50,
    webhooks: 10,
    support: 'priority'
  },
  ENTERPRISE: {
    name: 'Enterprise',
    monthlyPrice: 99,          // USD $99/mes
    stores: -1,                // ilimitado
    teamMembers: 20,
    syncOpsPerDay: 50000,
    storageGB: 500,
    webhooks: 50,
    support: 'dedicated'
  }
}
```

### Límites por plan

| Feature              | Free | Pro  | Enterprise |
|----------------------|------|------|------------|
| Tiendas conectadas   | 1    | 5    | Ilimitado  |
| Miembros equipo      | 1    | 5    | 20         |
| Ops sync/día         | 100  | 5,000| 50,000     |
| Almacenamiento (GB)  | 1    | 50   | 500        |
| Webhooks             | 2    | 10   | 50         |
| Soporte              | Email| Prior.| Dedicado  |

---

## 2. Estados de la suscripción

```
┌──────────┐
│ CREATED  │  ← se crea con tenant, plan FREE, status ACTIVE
└────┬─────┘
     │
     ▼
┌─────────────────┐      ┌───────────┐      ┌────────────┐
│     ACTIVE      │──────│ PAST_DUE  │──────│ CANCELLED  │
│ (plan activo)   │      │ (grace 3d)│      │ (downgrade │
└─────────────────┘      └───────────┘      │  a FREE)   │
                                           └────────────┘
     │
     ▼ (trial)
┌──────────┐
│  TRIAL   │  ← 14 días gratis (futuro)
└──────────┘
```

**Transiciones:**
- `CREATED → ACTIVE`: inmediatamente al crear tenant
- `ACTIVE → PAST_DUE`: falla el cobro en renovación
- `PAST_DUE → ACTIVE`: cobro exitoso en retry
- `PAST_DUE → CANCELLED`: grace period (3 días) expiró
- `CANCELLED → ACTIVE`: usuario hace upgrade manual

---

## 3. Endpoints de la API

### Auth / Tenant

| Método | Endpoint                    | Descripción                    | Auth |
|--------|-----------------------------|--------------------------------|------|
| GET    | `/api/auth/tenant/my-tenants`| Lista tenants del usuario      | JWT  |
| POST   | `/api/auth/tenant/upsert`   | Crear/actualizar tenant        | JWT  |
| GET    | `/api/auth/tenant/current`   | Tenant activo del usuario      | JWT  |

### Suscripciones

| Método | Endpoint                       | Descripción               | Auth |
|--------|--------------------------------|---------------------------|------|
| GET    | `/api/subscriptions/current`   | Suscripción actual        | JWT  |
| GET    | `/api/subscriptions/plans`      | Lista de planes           | JWT  |
| POST   | `/api/subscriptions/change-plan`| Upgrade/downgrade plan    | JWT  |
| POST   | `/api/subscriptions/cancel`     | Cancelar al final período | JWT  |
| POST   | `/api/subscriptions/usage`     | Registrar uso de recurso  | JWT  |

### MercadoPago

| Método | Endpoint                        | Descripción              | Auth |
|--------|---------------------------------|--------------------------|------|
| POST   | `/api/payments/create-preference`| Generar preference MP   | JWT  |
| POST   | `/api/webhooks/mercadopago`     | Webhook IPN de MP        | NONE |
| GET    | `/api/payments/success`         | Redirect post-pago        | SESSION |

---

## 4. Flujo de upgrade a PRO (MercadoPago Checkout Pro)

```
1. Usuario en Step 3 (selección de plan) → hace click en "Upgrade to Pro"
2. Frontend → POST /api/payments/create-preference
   Body: { planType: 'PRO', billingCycle: 'monthly' }
3. Backend → crea preferencia MP con preferencia de precio
4. Backend → responde con { preferenceId, initPoint }
5. Frontend → redirect a initPoint (URL de MercadoPago)
6. Usuario paga en MP → MP redirect a /api/payments/success?collection_id=XXX
7. Webhook MP → POST /api/webhooks/mercadopago
   → actualiza subscription.status = 'ACTIVE'
   → guarda mercadopagoSubscriptionId
8. Frontend → polling GET /api/subscriptions/current hasta ver status = ACTIVE
9. Onboarding completo → usuario → dashboard
```

---

## 5. Detección de límites (middleware/guard)

### Soft Limit (≥ 80% uso)
- Toast warning en dashboard
- Email de alerta al usuario

### Hard Limit (≥ 100% uso)
- HTTP 402: `{ error: 'LimitExceeded', upgradeUrl: '/onboarding?step=3', currentUsage: {...} }`
- siguiente operación rechazada

### Endpoints protegidos (validan suscripción)
```
GET  /api/sync/products
POST /api/sync/products
GET  /api/sync/orders
POST /api/sync/orders
POST /api/stores/connect
```

---

## 6. Archivos existentes y por crear

### Backend — Estructura de archivos

```
apps/backend/src/
├── domain/
│   └── entities/
│       ├── tenant.entity.ts       ✅ existente
│       ├── user.entity.ts          ✅ existente
│       └── subscription.entity.ts  🔲 POR CREAR
│
├── application/
│   ├── auth/
│   │   ├── auth.service.ts         ✅ existente
│   │   ├── jwt.strategy.ts         ✅ existente
│   │   └── jwt-auth.guard.ts       ✅ existente
│   │
│   └── subscription/               🔲 POR CREAR
│       ├── subscription.module.ts
│       ├── subscription.service.ts
│       ├── plan.service.ts
│       ├── usage.service.ts
│       └── repositories/
│           └── ISubscriptionRepository.ts
│
└── infrastructure/
    ├── controllers/
    │   ├── auth/
    │   │   └── tenant.controller.ts  ✅ existente
    │   └── subscription.controller.ts 🔲 POR CREAR
    │
    └── services/
        └── mercadopago/
            ├── mercadopago.service.ts 🔲 POR CREAR
            └── mercadopago-webhook.service.ts 🔲 POR CREAR
```

### Frontend — Estructura de archivos

```
apps/frontend/
├── app/
│   ├── onboarding/
│   │   ├── page.tsx                ✅ existente
│   │   ├── steps/
│   │   │   ├── Step1Tenant.tsx     ✅ existente
│   │   │   ├── Step2Store.tsx      ✅ existente
│   │   │   ├── Step3Plan.tsx       ✅ existente
│   │   │   └── Step4Payment.tsx    🔲 POR CREAR
│   │   └── components/
│   │       └── OnboardingWizard.tsx ✅ existente
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   └── tenant/
│   │   │       └── route.ts        ✅ existente
│   │   ├── subscriptions/
│   │   │   └── route.ts            🔲 POR CREAR
│   │   └── payments/
│   │       ├── create-preference/
│   │       │   └── route.ts        🔲 POR CREAR
│   │       └── success/
│   │           └── route.ts        🔲 POR CREAR
│   │
│   └── (dashboard)/
│       └── page.tsx                🔲 POR CREAR
```

---

## 7. Implementación paso a paso

### Fase 1: Suscripción FREE automática al crear tenant (✅ Parcialmente hecho)

El tenant se crea en Step 1 del onboarding. La suscripción FREE se debe crear automáticamente en la misma transacción.

**Pendiente:** Verificar que `subscription.service.ts` y el repositorio se crearon. Si no existen, crear:

1. `src/domain/entities/subscription.entity.ts`
2. `src/application/subscription/subscription.module.ts`
3. `src/application/subscription/subscription.service.ts`
4. `src/application/subscription/repositories/ISubscriptionRepository.ts`
5. `src/infrastructure/controllers/subscription.controller.ts`

**Flujo correcto:**
```
Step1Tenant.tsx → POST /api/auth/tenant/upsert
  → Backend: crea Tenant + Subscription(FREE, ACTIVE)
  → Response: { tenant, subscription }
```

### Fase 2: API de suscripción

Crear endpoints:
- `GET /api/subscriptions/current` → `{ subscription, usage, limits }`
- `GET /api/subscriptions/plans` → `{ plans: PLANS }`
- `POST /api/subscriptions/change-plan` → upgrade/downgrade
- `POST /api/subscriptions/cancel` → marca cancelAtPeriodEnd

### Fase 3: Integración MercadoPago

1. `MercadoPagoService`:
   - `createPreference(planType, billingCycle, tenantId)`
   - `getSubscriptionStatus(mercadopagoSubscriptionId)`

2. Webhook handler `POST /api/webhooks/mercadopago`:
   - Validar payload MP (signature verification)
   - Idempotencia: guardar `collection_id` para evitar double-processing
   - Actualizar `subscription.status` según topic

3. Página de success `/api/payments/success`:
   - Mostrar confirmación
   - Poll subscription status

### Fase 4: Verificación de límites (guard)

1. `SubscriptionGuard` (global guard):
   - En cada request a `/api/sync/*`
   - Obtener subscription del tenant
   - Comparar uso actual vs límites del plan
   - Si excede → HTTP 402

2. `UsageService`:
   - `trackUsage(tenantId, metric, value)`
   - `checkLimit(tenantId, metric)` → `{ allowed: boolean, usage: number, limit: number }`

### Fase 5: Cron jobs

1. `RenewSubscriptionJob` (daily):
   - Buscar subscriptions con `currentPeriodEnd < today`
   - Intentar cobro via MercadoPago
   - Si falla → `status = PAST_DUE`

2. `ExpireTrialJob` (hourly):
   - Buscar subscriptions TRIAL con `currentPeriodEnd < today`
   - Marcar como `PAST_DUE` o `CANCELLED`

---

## 8. Variables de entorno requeridas

### Backend (.env)
```bash
# Auth
AUTH_SECRET=               # Mismo valor que NEXTAUTH_SECRET del frontend
JWT_SIGN_SECRET=           # Mismo que AUTH_SECRET

# MercadoPago
MERCADO_PAGO_ACCESS_TOKEN= # Token real de MP
MERCADO_PAGO_PUBLIC_KEY=    # Public key MP
MP_WEBHOOK_URL=https://tu-dominio.com/api/webhooks/mercadopago
MP_SANDBOX=false            # true para testing

# Suscripciones
SUBSCRIPTION_TRIAL_DAYS=14
SUBSCRIPTION_GRACE_PERIOD_DAYS=3
DEFAULT_PLAN=FREE
```

### Frontend (.env.local)
```bash
NEXTAUTH_SECRET=            # Mismo valor que AUTH_SECRET del backend
NEXTAUTH_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
```

⚠️ **CRÍTICO:** `AUTH_SECRET` (backend) y `NEXTAUTH_SECRET` (frontend) **DEBEN ser idénticos**. Si no lo son, el JWT validation falla con 401.

---

## 9. Testing checklist

### Antes de decir "implementación completa"

1. ✅ `pnpm dev` levanta sin errores
2. ✅ Step 1 del onboarding guarda el tenant (respuesta 200)
3. ✅ La suscripción FREE se crea automáticamente
4. ✅ `GET /api/subscriptions/current` devuelve la suscripción
5. ✅ `GET /api/subscriptions/plans` devuelve los 3 planes
6. ✅ MercadoPago preference se genera sin errores (sandbox)
7. ✅ Webhook MP actualiza el estado de la suscripción
8. ✅ Límites se verifican en cada request de sync
9. ✅ HTTP 402 cuando se exceden los límites
10. ✅ Sin errores de consola en el frontend

---

## 10. Notas importantes de arquitectura

1. **No almacenar credenciales MP en DB** → usar variables de entorno
2. **Idempotencia en webhooks** → guardar `collection_id` o `preapproval_id` para evitar double-processing
3. **Fallback si MP cae** → Mantener acceso FREE por 48h si el servicio no responde
4. **Audit log** → guardar todos los cambios de plan con timestamp y usuario
5. **El plan FREE es siempre el default** → ningún tenant empieza sin suscripción
6. **Un tenant = una suscripción activa** → `tenantId` es UNIQUE en la tabla subscription

---

## 11. Flujo de datos completo

```
User signup (NextAuth credentials)
    │
    ▼
Session JWT creado (frontend)
    │
    ▼
Step 1: POST /api/auth/tenant/upsert
  Authorization: Bearer <JWT>
  Body: { name: "Mi Empresa" }
    │
    ├─► Backend valida JWT (JwtAuthGuard)
    ├─► Backend crea Tenant
    ├─► Backend crea Subscription(FREE, ACTIVE)
    └─► Response: { tenant: { id, name }, subscription: { id, planType } }
    │
    ▼
Step 2: POST /api/stores/connect
    │
    ▼
Step 3: GET /api/subscriptions/plans → muestra planes
  Usuario selecciona PRO
    │
    ▼
  POST /api/payments/create-preference
    │
    ▼
  Redirect a MercadoPago (initPoint)
    │
    ▼
  Usuario paga → MP redirect a /api/payments/success?collection_id=XXX
    │
    ▼
  Webhook MP → POST /api/webhooks/mercadopago
    │
    ▼
  Backend actualiza subscription → planType: 'PRO', status: 'ACTIVE'
    │
    ▼
  Frontend polling → GET /api/subscriptions/current
    │
    ▼
  Onboarding completo → dashboard
```

---

*Documento generado: 03/06/2026*
*Última actualización: June 2026*
*Versión: 2.0*