# SPEC.md — Módulo de Suscripciones
## shopify-sync-stored · SaaS Multi-Tenant Shopify Sync

---

## 1. Visión General

### Objetivo
Gestionar el ciclo de vida completo de las suscripciones de los tenants en el SaaS: trial, planes de pago (Basic, Pro, Enterprise), cobros recurrentes vía MercadoPago, webhooks de notificación (IPN), y control de acceso basado en el plan activo.

### Stack Tecnológico
- **Backend**: NestJS + TypeORM + PostgreSQL
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS 4 + Aura Design
- **Pasarela de pagos**: MercadoPago (REST API + Webhooks IPN)
- **Monorepo**: Turborepo + pnpm

### Fuente de verdad
- `wiki/specs/REQUERIMIENTOS_GENERALES.md` (RF-34 a RF-36, RNF-17, RNF-26)
- `wiki/specs/USER_STORIES.md` (HU-16)
- `wiki/specs/ONBOARDING_MULTISTEP_5_STEPS.md` (sección de suscripciones y MercadoPago)
- `apps/backend/src/domain/entities/subscription.entity.ts` (estado actual del código)

---

## 2. Modelo de Datos

### 2.1 Extensiones a la Entidad `Subscription`

La entidad existente `Subscription` requiere los siguientes campos adicionales:

```typescript
// apps/backend/src/domain/entities/subscription.entity.ts

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
  })
  planType: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @CreateDateColumn()
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEndDate: Date;

  // === CAMPOS NUEVOS ===

  @Column({ nullable: true })
  externalSubscriptionId: string;   // ID de suscripción en MercadoPago (preapproval id)

  @Column({ nullable: true })
  externalPlanId: string;           // ID del plan en MercadoPago (preapproval_plan id)

  @Column({
    type: 'enum',
    enum: BillingPeriod,
    default: BillingPeriod.MONTHLY,
  })
  billingPeriod: BillingPeriod;

  @Column({ default: false })
  autoRecurrent: boolean;          // Si la suscripción se renueva automáticamente

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  lastBillingDate: Date;            // Última fecha de cobro

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  nextBillingDate: Date;            // Próxima fecha de cobro

  @Column({ nullable: true })
  paymentMethodId: string;          // ID del método de pago guardado en MP

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amountPaid: number;               // Monto total pagado histórico

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 2.2 Enum `BillingPeriod`

```typescript
// apps/backend/src/domain/enums/billing-period.enum.ts

export enum BillingPeriod {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}
```

### 2.3 Enum `SubscriptionPlan` (actualizado)

```typescript
// apps/backend/src/domain/enums/subscription-plan.enum.ts

export enum SubscriptionPlan {
  TRIAL = 'TRIAL',
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

// Precios en USD (referencia)
export const PLAN_PRICING = {
  [SubscriptionPlan.BASIC]: { monthly: 29, yearly: 290 },
  [SubscriptionPlan.PRO]: { monthly: 79, yearly: 790 },
  [SubscriptionPlan.ENTERPRISE]: { monthly: 199, yearly: 1990 },
};
```

### 2.4 Enum `SubscriptionStatus` (actualizado)

```typescript
// apps/backend/src/domain/enums/subscription-status.enum.ts

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELED = 'CANCELED',
  PENDING_PAYMENT = 'PENDING_PAYMENT',   // NUEVO: plan seleccionado pero sin pago
  SUSPENDED = 'SUSPENDED',                // NUEVO: pago fallido o vencido
}
```

### 2.5 Tabla de Planes y Límites

| Plan       | Mensual | Anual | Conexiones | Tiendas | Usuarios equipo | Trial |
|------------|---------|-------|------------|---------|------------------|-------|
| **TRIAL**  | —       | —     | 1          | 1       | 0                | 7 días |
| **BASIC**  | $29     | $290  | 3          | 2       | 3                | — |
| **PRO**    | $79     | $790  | 10         | 5       | 10               | — |
| **ENTERPRISE** | $199 | $1990 | unlimited | unlimited | unlimited     | — |

---

## 3. Arquitectura del Módulo (Clean Architecture)

```
apps/backend/src/application/subscription/
├── subscription.module.ts              ← Declaración NestJS
├── subscription.service.ts            ← Casos de uso (lógica de negocio)
├── subscription.controller.ts         ← Endpoints HTTP (opcional, para admin)
├── dtos/
│   ├── create-subscription.dto.ts
│   ├── update-subscription.dto.ts
│   ├── subscription-response.dto.ts
│   └── plan.dto.ts
├── repositories/
│   └── ISubscriptionRepository.ts     ← Interfaz abstracta
└── guards/
    └── subscription-access.guard.ts   ← Verifica acceso según plan

apps/backend/src/infrastructure/
├── repositories/subscription/
│   └── TypeORMSubscriptionRepository.ts
├── mercadopago/
│   ├── mercadopago.service.ts         ← Integración con MP REST API
│   └── mercadopago-webhook.service.ts ← Procesamiento de IPN
├── cron/
│   └── subscription.cron.ts            ← Expiración de trials + billing
└── email/
    └── subscription-email.service.ts  ← Notificaciones de cobro/suspensión
```

---

## 4. Integración con MercadoPago

### 4.1 Flujo de Alto Nivel (Link de Pago — Sin Plan)

```
1. Usuario en Step 2 del onboarding → POST /api/onboarding/preference
2. Backend crea preapproval en MP (sin preapproval_plan_id) → devuelve initPoint
3. Frontend redirige a /payments/status?preapproval_id=X&token=<firma>
4. MP muestra checkout → usuario paga → MP redirige a back_url (/payments/status)
5. Frontend hace polling cada 2s a GET /api/onboarding/public/preapproval-status
   (endpoint público protegido por un token firmado, no requiere JWT de NextAuth)
6. Webhook MP recibe "subscription_preapproval" → status "authorized" o "active"
   → Backend busca tenant por external_reference (tenant:<id>)
   → Persiste externalSubscriptionId en la suscripción
   → Avanza onboardingStatus del tenant
7. Polling recibe paymentApproved=true → muestra "Pago aprobado" + botón "Continuar"
8. Usuario presiona "Continuar" → el frontend actualiza sesión (NextAuth) y
   navega a /onboarding?step=3
```

#### 4.1.1 Endpoint público de polling

La página `/payments/status` es accesible sin sesión activa (el usuario acaba
de salir de MP). Para poder consultar el estado del preapproval sin JWT:

- `MercadoPagoTokenService` firma un token de corta duración con
  `{ preapprovalId, tenantId, iat, exp }` usando `AUTH_SECRET`.
- El backend (`OnboardingPublicController`) valida el token y, si la firma
  caduca o no coincide, responde `401`.
- El polling se detiene cuando el backend devuelve `pollingRequired: false`.

#### 4.1.2 Resiliencia ante el webhook retrasado

`OnboardingService.getPreapprovalStatusPublic()` aplica una salvaguarda: si la
suscripción figura `ACTIVE` en MP pero el `onboardingStatus` del usuario sigue
en `PENDING_PLAN_SELECTION`, lo promueve automáticamente. Esto evita
redirigir al usuario a step 2 cuando el webhook aún no impactó la DB local.

### 4.2 Integración via REST API

**NO usar el MCP de MercadoPago para integración de pagos.** Usar la REST API directamente:

- SDK: `@mercadopago/sdk/rest` o fetch nativo
- Sandbox: `https://sandbox.mercadopago.com`
- Producción: `https://api.mercadopago.com`

**Preapproval Plan** (planes recurrentes):
- Crear plan: `POST /v1/preapproval_plan`
- Actualizar plan: `PUT /v1/preapproval_plan/{id}`
- Eliminar plan: `DELETE /v1/preapproval_plan/{id}`

**Preapproval** (suscripción activa):
- Crear suscripción: `POST /v1/preapproval`
- Actualizar suscripción: `PUT /v1/preapproval/{id}`
- Cancelar suscripción: `PUT /v1/preapproval/{id}` (status: cancelled)

### 4.3 Flujo Implementado: Link de Pago (Sin Plan, Sin Card Token)

Este es el flujo actualmente implementado. No usa `card_token_id` ni el SDK frontend de MP:

```
1. Frontend → POST /api/onboarding/preference { planType, billingPeriod, payerEmail }
2. Backend → POST /v1/preapproval a MP (sin preapproval_plan_id, status: pending)
   Body incluye: back_url, external_reference="tenant:<tenantId>", auto_recurring
3. Backend responde { preapprovalId, initPoint }
4. Frontend → redirige a /payments/status?preapproval_id=<id>
5. MP muestra checkout → usuario paga → MP redirige a back_url (/payments/status)
6. Frontend polling → GET /api/onboarding/subscription/preapproval/:id
7. Webhook MP → "subscription_preapproval" → status authorized/active
   → Persiste externalSubscriptionId, avanza onboarding
8. Polling detecta éxito → redirect a dashboard
```

### 4.4 Variables de Entorno (resumen)

Ver `wiki/api/environment-variables.md` y `wiki/frontend/environment-variables.md`
para el detalle completo. Resumen relevante al módulo de suscripciones:

```env
# Backend
MERCADOPAGO_ACCESS_TOKEN=***      # Token MP (sandbox o producción)
MERCADOPAGO_PUBLIC_KEY=           # Public key (no usada en flujo link de pago)
MERCADOPAGO_NOTIFICATION_URL=     # URL pública del webhook (tunnel/ngrok en dev)
MERCADOPAGO_SANDBOX=true          # true = sandbox, false = producción
MERCADOPAGO_CURRENCY=COP          # Moneda de la cuenta MP
AUTH_SECRET=***                   # Firma el token público del polling
FRONTEND_URL=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001   # Única URL del backend
```

---

## 5. Estados y Transiciones

### 5.1 Diagrama de Estados

```
                    ┌─────────────────────────────┐
                    │       CREATED               │
                    │  (durante onboarding)       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                              │
              [skip trial]                  [paga plan]
                    │                              │
                    ▼                              ▼
         ┌──────────────────┐          ┌──────────────────┐
         │ TRIAL (7 días)   │          │ PENDING_PAYMENT  │
         │ status: ACTIVE   │          │ status: PENDING  │
         │ planType: TRIAL  │          │ planType: BASIC/ │
         └────────┬─────────┘          │ PRO/ENTERPRISE   │
                  │                    └────────┬─────────┘
                  │ expiration                    │ pago completado
                  │                               ▼
                  │                    ┌──────────────────┐
                  ▼                    │ ACTIVE           │
         ┌──────────────────┐          │ status: ACTIVE  │
         │ EXPIRED          │          │ autoRecurrent    │
         │ status: EXPIRED  │          │ = true           │
         └──────────────────┘          └────────┬─────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                    │                         │
                            [cobro exitoso]            [cobro falla]
                                    │                         │
                                    ▼                         ▼
                           ┌──────────────────┐     ┌──────────────────┐
                           │ ACTIVE           │     │ SUSPENDED        │
                           │ (renueva)       │     │ status: SUSPENDED│
                           └──────────────────┘     └────────┬─────────┘
                                                            │
                                              ┌─────────────┴─────────────┐
                                              │                          │
                                      [paga deuda]              [90 días suspendido]
                                              │                          │
                                              ▼                          ▼
                                    ┌──────────────────┐    ┌──────────────────┐
                                    │ ACTIVE           │    │ CANCELED         │
                                    │ (reactiva)      │    │ status: CANCELED │
                                    └──────────────────┘    └──────────────────┘
```

### 5.2 Transiciones Válidas

| Estado Actual       | Evento                 | Estado Siguiente    |
|---------------------|------------------------|---------------------|
| PENDING_PAYMENT     | Pago completado        | ACTIVE              |
| PENDING_PAYMENT     | Skip / Expiró          | EXPIRED             |
| TRIAL               | Trial expiró           | EXPIRED             |
| TRIAL               | Upgrade a plan         | PENDING_PAYMENT     |
| ACTIVE              | Cobro exitoso          | ACTIVE (renueva)    |
| ACTIVE              | 3 cobros fallidos      | SUSPENDED           |
| ACTIVE              | Usuario cancela        | CANCELED            |
| SUSPENDED           | Paga deuda             | ACTIVE              |
| SUSPENDED           | 90 días sin pagar      | CANCELED            |

---

## 6. APIs del Backend

### 6.1 Endpoints de Suscripción

|| Método | Ruta                              | Descripción | Auth |
|--------|-----------------------------------|-------------|------|
| GET    | `/api/subscriptions/current`      | Obtener suscripción activa del tenant | JWT |
| POST   | `/api/subscriptions/plans`         | Listar planes disponibles | JWT |
| POST   | `/api/onboarding/preference`       | Crear link de pago (preapproval) | JWT |
| GET    | `/api/onboarding/subscription/preapproval/:preapprovalId` | Consultar estado del preapproval (polling) | JWT |
| GET    | `/api/subscriptions/status`        | Estado de la suscripción actual | JWT |
| PUT    | `/api/subscriptions/upgrade`       | Cambiar a plan superior (guarda externalSubscriptionId) | JWT |
| POST   | `/api/subscriptions/cancel`        | Cancelar suscripción | JWT |
| POST   | `/api/subscriptions/reactivate`    | Reactivar suscripción suspendida | JWT |
| POST   | `/api/webhooks/mercadopago`        | Webhook IPN de MP (subscription_preapproval) | NONE |

### 6.2 Endpoint: Crear Preapproval (Link de Pago — Implementado)

**Ruta:** `POST /api/onboarding/preference`

**Request Body:**
```typescript
{
  planType: 'BASIC' | 'PRO' | 'ENTERPRISE';
  billingPeriod: 'MONTHLY' | 'YEARLY';
  payerEmail: string;
}
```

**Respuesta:**
```typescript
{
  preapprovalId: string;   // ID del preapproval en MP
  initPoint: string;       // URL de pago de MP (sandbox o producción)
  status: 'pending';
}
```

### 6.3 Endpoint: Polling de Estado

**Ruta:** `GET /api/onboarding/subscription/preapproval/:preapprovalId`

**Respuesta:**
```typescript
{
  status: 'pending' | 'authorized' | 'active' | 'cancelled' | 'paused' | 'expired';
  preapprovalId: string;
  planType: string;
}
```

### 6.4 Endpoint: Webhook de MercadoPago

**Ruta:** `POST /api/webhooks/mercadopago`

**Topic procesado:** `subscription_preapproval`

**Eventos que disparan éxito:**
- `authorized` → pago aprobado, activa suscripción
- `active` → suscripción activa

**Vinculación:** `external_reference` con formato `tenant:<tenantId>` permite recuperar el contexto si el `externalSubscriptionId` aún no está persistido.

### 6.5 Endpoint: Cancelar Suscripción

**Ruta:** `POST /api/subscriptions/cancel`

**Request Body:**
```typescript
{
  reason: 'USER_REQUEST' | 'PAYMENT_FAILED' | 'BILLING_CYCLE_END';
}
```

**Lógica:**
1. Marcar `autoRecurrent = false`
2. Enviar `PUT /v1/preapproval/{id}` a MP con status `cancelled`
3. Actualizar `status = CANCELED`
4. Enviar email de confirmación al usuario

---

## 7. Cron Jobs

### 7.1 Expiración de Trials

**Archivo:** `infrastructure/cron/subscription.cron.ts` (ya existe, verificar que funcione con 7 días)

```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async handleSubscriptionExpirations() {
  // Marcar TRIAL expirados como EXPIRED
}
```

**NOTA:** El código actual usa 14 días. Cambiar a 7 días según la wiki.

### 7.2 Verificación de Cobros Pendientes

```typescript
@Cron(CronExpression.EVERY_DAY_AT_8AM)
async checkPendingPayments() {
  // Verificar suscripciones en PENDING_PAYMENT hace más de 48h
  // → Notificar al usuario
  // → Si pasan 7 días → marcar como EXPIRED
}
```

### 7.3 Verificación de Cobros Recurrentes

```typescript
@Cron(CronExpression.EVERY_DAY_AT_9AM)
async checkUpcomingBillingDates() {
  // Suscripciones con nextBillingDate en los próximos 3 días
  // → Enviar recordatorio por email
}
```

### 7.4 Suspensión por Pago Vencido

```typescript
@Cron(CronExpression.EVERY_DAY_AT_10AM)
async handleOverduePayments() {
  // Suscripciones con payment overdue
  // → 1° vencimiento: notificar
  // → 7° día: marcar SUSPENDED
  // → 90° día: marcar CANCELED
}
```

---

## 8. Control de Acceso Basado en Plan

### 8.1 Strategy Pattern para Feature Flags

```typescript
// apps/backend/src/application/subscription/subscription-access.service.ts

@Injectable()
export class SubscriptionAccessService {
  private readonly limits = {
    [SubscriptionPlan.TRIAL]: {
      maxConnections: 1,
      maxStores: 1,
      maxTeamMembers: 0,
      canSyncInventory: false,
      canSyncOrders: false,
      canAccessMarketplace: false,
    },
    [SubscriptionPlan.BASIC]: {
      maxConnections: 3,
      maxStores: 2,
      maxTeamMembers: 3,
      canSyncInventory: true,
      canSyncOrders: false,
      canAccessMarketplace: false,
    },
    [SubscriptionPlan.PRO]: {
      maxConnections: 10,
      maxStores: 5,
      maxTeamMembers: 10,
      canSyncInventory: true,
      canSyncOrders: true,
      canAccessMarketplace: true,
    },
    [SubscriptionPlan.ENTERPRISE]: {
      maxConnections: -1, // unlimited
      maxStores: -1,
      maxTeamMembers: -1,
      canSyncInventory: true,
      canSyncOrders: true,
      canAccessMarketplace: true,
    },
  };

  canAccessFeature(tenantId: string, feature: FeatureKey): boolean {
    const subscription = await this.subscriptionRepository.findByTenantId(tenantId);
    const limits = this.limits[subscription.planType];
    return limits[feature] === true || limits[feature] === -1;
  }

  canAddConnection(tenantId: string): boolean {
    const subscription = await this.subscriptionRepository.findByTenantId(tenantId);
    const limits = this.limits[subscription.planType];
    if (limits.maxConnections === -1) return true;
    const currentCount = await this.connectionRepository.countByTenant(tenantId);
    return currentCount < limits.maxConnections;
  }
}
```

### 8.2 Guard para Endpoints Protegidos

```typescript
// apps/backend/src/application/subscription/guards/plan-access.guard.ts

@Injectable()
export class PlanAccessGuard implements CanActivate {
  constructor(private readonly accessService: SubscriptionAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId; // inyectado por TenantInterceptor

    const feature = this.reflector.get<string>('feature', context.getHandler());
    return this.accessService.canAccessFeature(tenantId, feature);
  }
}
```

**Uso en controllers:**
```typescript
@Get('/marketplace')
@UseGuards(AuthGuard, PlanAccessGuard)
@SetMetadata('feature', 'canAccessMarketplace')
async getMarketplace() {}
```

---

## 9. Frontend — Componentes y Páginas

### 9.1 Estructura de Rutas

```
apps/frontend/app/(protected)/
├── subscription/
│   ├── page.tsx                       → Resumen de suscripción actual
│   ├── plans/page.tsx                 → Comparar planes disponibles
│   ├── upgrade/page.tsx               → Flujo de upgrade
│   └── success/page.tsx              → Post-pago (redirect desde MP)
└── settings/
    └── subscription/page.tsx          → Gestión completa (cancelar, cambiar plan)
```

### 9.2 Componentes del Frontend

```
apps/frontend/components/subscription/
├── SubscriptionCard.tsx              → Muestra plan actual + estado
├── PlanSelector.tsx                   → Cards comparativas de planes
├── PaymentForm.tsx                   → Formulario de pago con SDK MP
├── UpgradeButton.tsx                 → Botón de upgrade contextual
└── SubscriptionStatusBadge.tsx       → Badge visual del estado

apps/frontend/components/mercadopago/
├── MercadoPagoProvider.tsx            → Context provider para SDK MP
├── CardTokenizer.tsx                  → Input de tarjeta (SDK frontend)
└── PaymentButton.tsx                 → Botón que inicia el flujo de pago
```

### 9.3 Flujo de UI: Selección de Plan (Step 2 del Onboarding)

```
┌──────────────────────────────────────────────────────────────────┐
│  ONBOARDING · PASO 2                                             │
│                                                                  │
│  Selecciona tu plan                                              │
│  Comienza con 7 días gratis o elige el plan que mejor se adapte │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │   BASIC    │  │    PRO     │  │ ENTERPRISE  │               │
│  │   $29/mes  │  │  $79/mes   │  │ $199/mes    │               │
│  │            │  │            │  │             │               │
│  │ · 3 conn   │  │ · 10 conn  │  │ · unlimited │               │
│  │ · 2 stores │  │ · 5 stores │  │ · unlimited  │               │
│  │ · 3 users  │  │ · 10 users │  │ · unlimited  │               │
│  │            │  │            │  │             │               │
│  │ [Elegir]   │  │ [Elegir]   │  │ [Elegir]    │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│                                                                  │
│  ¿No quieres pagar aún? [Activar Trial gratis]                   │
│                                                                  │
│  [← Anterior]                              [Siguiente →]          │
└──────────────────────────────────────────────────────────────────┘
```

### 9.4 Formulario de Pago

```tsx
// apps/frontend/components/mercadopago/PaymentForm.tsx
// "use client"

import { useMercadoPago } from '@/hooks/useMercadoPago';

export function PaymentForm({ planType, billingPeriod, onSuccess }: Props) {
  const { cardTokenId, isProcessing, error, createCardToken } = useMercadoPago();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokenId = await createCardToken(); // SDK frontend MP
    const response = await fetch('/api/subscriptions/create-preapproval', {
      method: 'POST',
      body: JSON.stringify({ planType, billingPeriod, cardTokenId }),
    });
    const { initPoint } = await response.json();
    window.location.href = initPoint; // Redirect a MP
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* MercadoPago CardInput fields */}
      <div id="cardNumber" />
      <div id="cardExpiration" />
      <div id="cardCVC" />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit" disabled={isProcessing}>
        {isProcessing ? 'Procesando...' : `Pagar ${PLAN_PRICING[planType][billingPeriod]}`}
      </button>
    </form>
  );
}
```

---

## 10. Flujo Completo de Usuario (Suscripción)

### 10.1 Flujo de Registro con Selección de Plan

```
1. Registro → POST /api/auth/register
   → Crea User + Tenant (status: TRIAL) + Subscription (TRIAL, 7 días)
   → Redirige a /onboarding?step=2

2. step=2 (Plan Selection)
   a. Usuario salta (skip) → POST /api/onboarding/subscription/skip
      → Subscription tetap TRIAL 7 días
      → Avanza a step=3
   b. Usuario selecciona plan → POST /api/subscriptions/create-preference
      → Crea preference en MP → devuelve initPoint
      → Frontend redirige a initPoint (MP checkout)
      → MP redirect a /subscription/success?external_id=XXX
      → Webhook MP → actualiza subscription status=ACTIVE
      → Avanza a step=3
```

### 10.2 Flujo de Upgrade (Dashboard)

```
1. Usuario en /settings/subscription → click "Hacer upgrade"
2. Se abre modal con PlanSelector
3. Usuario selecciona nuevo plan
4. PaymentForm aparece con SDK MP para ingresar tarjeta
5. Submit → POST /api/subscriptions/create-preapproval
6. Redirect a MP → usuario paga
7. Webhook MP → subscription.upgrade(newPlan, newStatus=ACTIVE)
8. UI actualiza para mostrar nuevo plan
```

### 10.3 Flujo de Cancelación

```
1. Usuario en /settings/subscription → click "Cancelar suscripción"
2. Modal confirma: "¿Estás seguro? Perderás acceso el [fecha]"
3. Usuario confirma → POST /api/subscriptions/cancel
4. Backend → PUT /v1/preapproval/{id} (cancel) + status=CANCELED
5. Email enviado con confirmación
6. UI muestra "Suscripción cancelada" + opción de reactive
```

---

## 11. Notificaciones por Email

### 11.1 Eventos y Templates

| Evento | Template | Canal |
|--------|----------|-------|
| Trial próximo a expirar (3 días antes) | `trial-expiring` | Email + push |
| Trial expirado | `trial-expired` | Email |
| Pago exitoso | `payment-success` | Email |
| Pago fallido | `payment-failed` | Email |
| Suscripción suspendida | `subscription-suspended` | Email |
| Cancelación confirmada | `subscription-canceled` | Email |
| Próximo cobro (3 días antes) | `upcoming-billing` | Email |

### 11.2 Servicio de Email

```typescript
// apps/backend/src/infrastructure/email/subscription-email.service.ts

@Injectable()
export class SubscriptionEmailService {
  async sendTrialExpiring(tenantId: string, daysLeft: number) {
    const tenant = await this.tenantRepository.findById(tenantId);
    const user = await this.userRepository.findOwnerByTenant(tenantId);
    await this.emailService.send({
      to: user.email,
      template: 'trial-expiring',
      data: { userName: user.name, daysLeft },
    });
  }

  async sendPaymentFailed(tenantId: string, reason: string) {
    // ...
  }
}
```

---

## 13. Arquitectura Serverless — AWS Lambdas para Cron Jobs

### 13.1 Decisión Arquitectural

Los cron jobs de suscripciones se implementan como **AWS Lambda functions** en lugar de procesos dentro del backend NestJS. Esto evita consumo de recursos constante y permite escalar independientemente.

**Principios:**
- El código detecta el entorno (`development` vs `production`) para ejecutarse en SAM local o invocar via AWS SDK
- Un paquete compartido (`packages/database`) provee acceso a TypeORM para ambos (NestJS y Lambdas)
- La lógica de negocio de suscripciones vive en el paquete compartido, no duplicada
- SAM (AWS Serverless Application Model) gestiona el deployment y testing local

### 13.2 Estructura del Monorepo Extendida

```
shopify-sync-stored/
├── apps/
│   ├── backend/                        ← NestJS (puerto 3001)
│   │   └── src/
│   │       ├── application/subscription/
│   │       │   ├── subscription.service.ts    ← Llama a repos del package
│   │       │   └── subscription.module.ts
│   │       └── infrastructure/
│   │           └── cron/
│   │               └── subscription.cron.ts   ← (Legacy, mantener por now)
│   │
│   └── functions/                       ← AWS Lambda functions
│       └── src/
│           ├── subscription/
│           │   ├── check-expirations.ts       ← Handler principal
│           │   ├── check-pending-payments.ts
│           │   └── index.ts
│           └── shared/
│               └── initialize.ts              ← Inicializa DB connection
│
├── packages/
│   ├── database/                        ← Acceso a DB compartido
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── typeorm.config.ts        ← DataSource singleton
│   │       ├── entities/
│   │       │   ├── index.ts
│   │       │   ├── subscription.entity.ts
│   │       │   ├── tenant.entity.ts
│   │       │   ├── user.entity.ts
│   │       │   └── store.entity.ts
│   │       ├── enums/
│   │       │   ├── index.ts
│   │       │   ├── subscription-plan.enum.ts
│   │       │   ├── subscription-status.enum.ts
│   │       │   ├── billing-period.enum.ts
│   │       │   └── ...
│   │       └── repositories/
│   │           ├── index.ts
│   │           ├── base.repository.ts          ← Clase base stateless
│   │           ├── subscription.repository.ts  ← Métodos estáticos/factory
│   │           ├── tenant.repository.ts
│   │           └── types.ts
│   │
│   └── config/                          ← Variables de entorno compartidas
│       ├── package.json
│       └── src/
│           ├── index.ts
│           └── environment.ts
│
├── infra/
│   └── sam/                            ← AWS SAM
│       ├── template.yaml               ← SAM template (Events + Functions)
│       ├── events/                     ← Eventos de test para SAM
│       │   ├── check-expirations.json
│       │   └── check-pending-payments.json
│       ├── buildspec.yml               ← CI/CD para SAM
│       └── README.md                   ← Instrucciones de deployment
│
├── turbo.json                          ← Actualizar para incluir functions
├── pnpm-workspace.yaml                 ← Actualizar para packages/database
└── .env.example                        ← Variables para ambos mundos
```

### 13.3 Paquete `packages/database` — Detalle

#### Objetivo
Evitar duplicación de entidades y lógica de acceso a datos entre NestJS y Lambdas. El paquete se instala como dependencia en ambos.

#### Dependencies del paquete

```json
// packages/database/package.json
{
  "name": "@shopify-sync/database",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./entities": "./dist/entities/index.js",
    "./enums": "./dist/enums/index.js",
    "./repositories": "./dist/repositories/index.js"
  },
  "dependencies": {
    "typeorm": "^0.3.20",
    "pg": "^8.11.3",
    "reflect-metadata": "^0.2.2"
  }
}
```

#### typeorm.config.ts — DataSource Singleton

```typescript
// packages/database/src/typeorm.config.ts

import { DataSource, DataSourceOptions } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { Tenant } from './entities/tenant.entity';
import { User } from './entities/user.entity';
import { Store } from './entities/store.entity';

// Singleton global para evitar múltiples conexiones
let dataSource: DataSource | null = null;

export const getDataSourceOptions = (): DataSourceOptions => {
  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'shopify_sync',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    entities: [Subscription, Tenant, User, Store],
    synchronize: false, // NUNCA en producción
    logging: process.env.NODE_ENV === 'development',
  };
};

export const initializeDataSource = async (): Promise<DataSource> => {
  if (dataSource && dataSource.isInitialized) {
    return dataSource;
  }

  dataSource = new DataSource(getDataSourceOptions());
  await dataSource.initialize();
  
  console.log('Database DataSource initialized');
  return dataSource;
};

export const getDataSource = async (): Promise<DataSource> => {
  if (!dataSource || !dataSource.isInitialized) {
    return initializeDataSource();
  }
  return dataSource;
};

// Para testing
export const closeDataSource = async (): Promise<void> => {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
    dataSource = null;
  }
};
```

#### Repositorio Base (sin DI)

```typescript
// packages/database/src/repositories/base.repository.ts

import { EntityManager, DataSource } from 'typeorm';
import { getDataSource } from '../typeorm.config';

export abstract class BaseRepository<T> {
  protected abstract entityClass: new () => T;

  protected async getManager(): Promise<EntityManager> {
    const ds = await getDataSource();
    return ds.manager;
  }

  async findOne(where: Record<string, unknown>): Promise<T | null> {
    const manager = await this.getManager();
    return manager.findOne(this.entityClass, { where });
  }

  async findMany(where: Record<string, unknown>): Promise<T[]> {
    const manager = await this.getManager();
    return manager.find(this.entityClass, { where });
  }

  async save(entity: T): Promise<T> {
    const manager = await this.getManager();
    return manager.save(this.entityClass, entity);
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    const manager = await this.getManager();
    await manager.update(this.entityClass, id, data);
  }
}
```

#### Repository de Suscripción (ejemplo)

```typescript
// packages/database/src/repositories/subscription.repository.ts

import { LessThan } from 'typeorm';
import { BaseRepository } from './base.repository';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

export class SubscriptionRepository extends BaseRepository<Subscription> {
  protected entityClass = Subscription;

  async findExpired(now: Date): Promise<Subscription[]> {
    const manager = await this.getManager();
    return manager
      .createQueryBuilder(Subscription, 's')
      .where('s.trialEndDate < :now', { now })
      .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      ..andWhere('s.planType = :planType', { planType: 'TRIAL' })
      .getMany();
  }

  async findPendingPayment(olderThanHours: number): Promise<Subscription[]> {
    const manager = await this.getManager();
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    return manager
      .createQueryBuilder(Subscription, 's')
      .where('s.status = :status', { status: SubscriptionStatus.PENDING_PAYMENT })
      .andWhere('s.createdAt < :cutoff', { cutoff })
      .getMany();
  }

  async findByNextBillingDate(beforeDate: Date): Promise<Subscription[]> {
    const manager = await this.getManager();
    return manager
      .createQueryBuilder(Subscription, 's')
      .where('s.nextBillingDate <= :beforeDate', { beforeDate })
      .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('s.autoRecurrent = :autoRecurrent', { autoRecurrent: true })
      .getMany();
  }

  async updateStatus(id: string, status: SubscriptionStatus): Promise<void> {
    const manager = await this.getManager();
    await manager.update(Subscription, id, { status });
  }
}

// Factory function (para uso en Lambda sin DI)
export const createSubscriptionRepository = async (): Promise<SubscriptionRepository> => {
  return new SubscriptionRepository();
};
```

### 13.4 AWS SAM — Template y Configuración

#### template.yaml

```yaml
# infra/sam/template.yaml

AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Timeout: 30
    MemorySize: 128
    Runtime: nodejs20.x
    Environment:
      Variables:
        NODE_ENV: !If [IsLocal, development, production]
        DATABASE_HOST: !Ref DatabaseHost
        DATABASE_PORT: 5432
        DATABASE_NAME: !Ref DatabaseName
        DATABASE_USER: !Ref DatabaseUser
        DATABASE_PASSWORD: !Ref DatabasePassword
    SnapStart:
      AutoApplyPolicy: true  # Reduce cold start

Conditions:
  IsLocal: !Equals [!Ref AWS::StackName, local-stack]

Parameters:
  DatabaseHost:
    Type: String
    Default: localhost
  DatabaseName:
    Type: String
    Default: shopify_sync
  DatabaseUser:
    Type: String
    Default: postgres
  DatabasePassword:
    Type: String
    NoEcho: true

Resources:
  # ============================================================
  # SUBSCRIPTION FUNCTIONS
  # ============================================================

  CheckSubscriptionExpirations:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: shopify-sync-sub-check-expirations
      Handler: dist/functions/subscription/check-expirations.handler
      CodeUri: ../../apps/functions
      Events:
        DailyCron:
          Type: Schedule
          Properties:
            Schedule: cron(0 0 * * ? *)
            Name: shopify-sync-daily-expiration-check
            Description: Marca trials expirados diariamente a medianoche UTC
      Policies:
        - arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess  # Por ahora, ajustar luego
        - arn:aws:iam::aws:policy/AmazonRDSDataFullAccess
      VpcConfig:
        SubnetIds: !If [IsLocal, !Ref AWS::NoValue, !Ref LambdaSubnets]
        SecurityGroupIds: !If [IsLocal, !Ref AWS::NoValue, !Ref LambdaSecurityGroup]

  CheckPendingPayments:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: shopify-sync-sub-check-pending-payments
      Handler: dist/functions/subscription/check-pending-payments.handler
      CodeUri: ../../apps/functions
      Events:
        DailyCron:
          Type: Schedule
          Properties:
            Schedule: cron(0 8 * * ? *)  # 8am UTC
            Name: shopify-sync-daily-pending-check
            Description: Verifica pagos pendientes + notifica

  CheckUpcomingBillingDates:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: shopify-sync-sub-check-upcoming-billing
      Handler: dist/functions/subscription/check-upcoming-billing.handler
      CodeUri: ../../apps/functions
      Events:
        DailyCron:
          Type: Schedule
          Properties:
            Schedule: cron(0 9 * * ? *)  # 9am UTC
            Name: shopify-sync-daily-billing-reminder

  HandleOverduePayments:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: shopify-sync-sub-handle-overdue
      Handler: dist/functions/subscription/handle-overdue.handler
      CodeUri: ../../apps/functions
      Events:
        DailyCron:
          Type: Schedule
          Properties:
            Schedule: cron(0 10 * * ? *)  # 10am UTC

Outputs:
  CheckSubscriptionExpirationsArn:
    Description: ARN de la función de expiración de suscripciones
    Value: !GetAtt CheckSubscriptionExpirations.Arn
    Export:
      Name: shopify-sync-check-expirations-arn

  CheckPendingPaymentsArn:
    Value: !GetAtt CheckPendingPayments.Arn
    Export:
      Name: shopify-sync-check-pending-payments-arn
```

### 13.5 Lambdas — Handlers

#### check-expirations.ts

```typescript
// apps/functions/src/subscription/check-expirations.ts

import { initializeDatabase, closeDatabase } from '../shared/initialize';
import { createSubscriptionRepository } from '@shopify-sync/database/repositories';
import { SubscriptionStatus } from '@shopify-sync/database/enums';

// Detecta si está corriendo en SAM local
const IS_SAM_LOCAL = process.env.AWS_SAM_LOCAL === 'true' 
  || process.env.NODE_ENV === 'development';

export const handler = async (event: unknown, context: Context) => {
  console.log(`[check-expirations] Running in ${IS_SAM_LOCAL ? 'SAM LOCAL' : 'AWS Lambda'}`);
  console.log('[check-expirations] Event:', JSON.stringify(event));

  try {
    // Inicializar conexión a la base de datos
    await initializeDatabase();

    // Crear repositorio (sin DI)
    const subscriptionRepo = await createSubscriptionRepository();

    // Ejecutar lógica de negocio
    const now = new Date();
    const expiredSubscriptions = await subscriptionRepo.findExpired(now);

    console.log(`[check-expirations] Found ${expiredSubscriptions.length} expired subscriptions`);

    for (const subscription of expiredSubscriptions) {
      await subscriptionRepo.updateStatus(subscription.id, SubscriptionStatus.EXPIRED);
      console.log(`[check-expirations] Marked subscription ${subscription.id} as EXPIRED`);
      
      // TODO: Enviar email de notificación (via Resend)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        processed: expiredSubscriptions.length,
        environment: IS_SAM_LOCAL ? 'sam-local' : 'aws-lambda',
      }),
    };
  } catch (error) {
    console.error('[check-expirations] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: (error as Error).message }),
    };
  } finally {
    // Mantener conexión abierta para warm starts
    // closeDatabase() solo si es shutdown definitivo
  }
};
```

#### shared/initialize.ts

```typescript
// apps/functions/src/shared/initialize.ts

import { initializeDataSource, closeDataSource } from '@shopify-sync/database/typeorm.config';
import { loadEnvironment } from '@shopify-sync/config';

let initialized = false;

export const initializeDatabase = async (): Promise<void> => {
  if (initialized) {
    console.log('[initialize] Database already initialized, skipping');
    return;
  }

  // Cargar variables de entorno desde .env.local o AWS Secrets Manager
  await loadEnvironment();

  // Inicializar TypeORM DataSource
  await initializeDataSource();
  
  initialized = true;
  console.log('[initialize] Database initialized successfully');
};

export const closeDatabase = async (): Promise<void> => {
  await closeDataSource();
  initialized = false;
  console.log('[initialize] Database connection closed');
};
```

### 13.6 Ejecución Local con SAM

#### setup.sh

```bash
# infra/sam/setup.sh

#!/bin/bash
set -e

echo "=== Setting up AWS SAM Local Environment ==="

# 1. Verificar que AWS SAM CLI esté instalado
if ! command -v sam --version &> /dev/null; then
    echo "Installing AWS SAM CLI..."
    brew install aws-sam-cli  # macOS
fi

# 2. Construir el proyecto (incluye packages/database)
echo "Building project..."
cd $(dirname "$0")/../..
pnpm run build --filter=@shopify-sync/database
pnpm run build --filter=functions
pnpm run build --filter=backend

# 3. Crear .env.local si no existe
if [ ! -f .env.local ]; then
    echo "Creating .env.local from example..."
    cp .env.example .env.local
fi

# 4. Iniciar PostgreSQL local (Docker)
echo "Starting PostgreSQL..."
docker compose up -d db

echo "=== SAM Local ready ==="
echo "Run: sam local start-api"
echo "Or: sam local invoke CheckSubscriptionExpirations -e infra/sam/events/check-expirations.json"
```

#### Comandos SAM

```bash
# Ejecutar una Lambda específica localmente
sam local invoke CheckSubscriptionExpirations \
  --event infra/sam/events/check-expirations.json \
  --env-vars infra/sam/env.json

# Iniciar API local (todas las Lambdas con HTTP events)
sam local start-api

# Build para producción
sam build

# Deploy a AWS
sam deploy --guided
```

#### env.json (para SAM local)

```json
{
  "CheckSubscriptionExpirations": {
    "NODE_ENV": "development",
    "AWS_SAM_LOCAL": "true",
    "DATABASE_HOST": "localhost",
    "DATABASE_PORT": "5432",
    "DATABASE_NAME": "shopify_sync",
    "DATABASE_USER": "postgres",
    "DATABASE_PASSWORD": "postgres"
  },
  "CheckPendingPayments": {
    "NODE_ENV": "development",
    "AWS_SAM_LOCAL": "true",
    "DATABASE_HOST": "localhost",
    "DATABASE_PORT": "5432",
    "DATABASE_NAME": "shopify_sync",
    "DATABASE_USER": "postgres",
    "DATABASE_PASSWORD": "postgres"
  }
}
```

### 13.7 package.json — Scripts para Functions

```json
// apps/functions/package.json

{
  "name": "@shopify-sync/functions",
  "version": "0.0.1",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "local": "sam local",
    "local:invoke": "sam local invoke",
    "local:start-api": "sam local start-api",
    "deploy": "sam deploy --config-env production"
  },
  "dependencies": {
    "@shopify-sync/database": "workspace:*",
    "@shopify-sync/config": "workspace:*"
  },
  "devDependencies": {
    "aws-sam-cli": "^1.0.0"
  }
}
```

### 13.8 Detección de Entorno — Código CompatIBLE

```typescript
// apps/functions/src/shared/environment.ts

export const Environment = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isSamLocal: process.env.AWS_SAM_LOCAL === 'true',
  
  isLocal: () => process.env.NODE_ENV === 'development' || process.env.AWS_SAM_LOCAL === 'true',
  
  getDataSourceConfig: () => ({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'shopify_sync',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  }),
};
```

### 13.9 Limitaciones y Consideraciones

1. **Cold Start:** TypeORM DataSource toma ~2-5s en inicializar. SAM local o Lambda en warm start es más rápido. Para producción, considerar `ProvisionedConcurrency` para las funciones críticas.

2. **DynamoDB vs PostgreSQL:** Para suscripciones, el acceso es simple (update status, find by date). Podría evaluarse migrar a DynamoDB para evitar cold starts de PostgreSQL en Lambda. Pero por ahora se comparte el mismo PostgreSQL.

3. **Secrets Manager:** En producción, `DATABASE_PASSWORD` debería venir de AWS Secrets Manager en lugar de Environment Variables. Actualizar `typeorm.config.ts` para soportar esto.

4. ** VPC:** Las Lambdas en producción deben estar en VPC privada para acceder al RDS. SAM local no usa VPC (conecta directo a localhost).

5. **Métricas y Logs:** Las Lambdas deben usar CloudWatch para logs. En SAM local, los logs van a la consola.

### 13.10 Flujo CI/CD para SAM

```yaml
# infra/sam/buildspec.yml

version: 0.2

phases:
  install:
    commands:
      - npm install -g aws-sam-cli
      - pnpm install --frozen-lockfile

  build:
    commands:
      - pnpm run build --filter=@shopify-sync/database
      - pnpm run build --filter=functions
      - sam build

  test:
    commands:
      - sam local invoke CheckSubscriptionExpirations -e events/check-expirations.json

  deploy:
    condition: manually-approved
    commands:
      - sam deploy --no-confirm-changeset

artifacts:
  - /template.yaml
  - /apps/functions/dist
```

---

## 14. Dependencias a Instalar

```bash
# Paquete database
pnpm --filter @shopify-sync/database add typeorm@^0.3.20 pg@^8.11.3 reflect-metadata@^0.2.2

# Paquete config
pnpm --filter @shopify-sync/config add dotenv

# Functions (Lambda)
pnpm --filter @shopify-sync/functions add @shopify-sync/database @shopify-sync/config
```

---

## 15. Checklist de Implementación (Actualizado)

### Fase 0: Infraestructura SAM
- [ ] Crear `packages/database` con entities, repos, typeorm.config
- [ ] Crear `packages/config` para variables de entorno
- [ ] Crear `apps/functions` con estructura de handlers
- [ ] Crear `infra/sam/template.yaml`
- [ ] Crear scripts de setup y eventos de test
- [ ] Actualizar `turbo.json` y `pnpm-workspace.yaml`
- [ ] Configurar Docker Compose para PostgreSQL local
- [ ] Testear SAM local con `sam local invoke`

### Fase 1: Modelo de Datos (sin cambios respecto a anterior)
- [ ] Campos nuevos en `Subscription` entity
- [ ] Enums actualizados (BillingPeriod, SubscriptionStatus, SubscriptionPlan)
- [ ] `ISubscriptionRepository` actualizado
- [ ] `TypeORMSubscriptionRepository` con nuevos métodos

### Fase 2: MercadoPago Service
- [ ] `MercadoPagoService` (REST API)
- [ ] `createPreapprovalPlan()`, `createPreapproval()`, `cancelPreapproval()`

### Fase 3: Webhook Handler
- [ ] Endpoint `POST /api/webhooks/mercadopago`
- [ ] Verificación de firma SHA256
- [ ] `handlePreapprovalEvent()`, `handlePaymentEvent()`

### Fase 4: Casos de Uso (Service) — Sin cambios
- [ ] CRUD completo de suscripciones

### Fase 5: Lambdas (en lugar de Cron NestJS)
- [ ] `check-expirations.ts` handler
- [ ] `check-pending-payments.ts` handler
- [ ] `check-upcoming-billing.ts` handler
- [ ] `handle-overdue.ts` handler
- [ ] SAM template con Schedule Events

### Fase 6: Control de Acceso
- [ ] `SubscriptionAccessService`
- [ ] `PlanAccessGuard`

### Fase 7: Frontend — Sin cambios

### Fase 8: Email — Sin cambios

### Fase 9: Documentación
- [ ] Actualizar `wiki/architecture/DICCIONARIO_DATOS.md`
- [ ] Agregar `wiki/architecture/SERVERLESS_ARCHITECTURE.md`
- [ ] Agregar `wiki/features/subscription.md` (actualizar con Lambdas)
- [ ] Tests unitarios para `SubscriptionRepository` (package database)

1. **Trial de 7 días (no 14):** El código actual en `SubscriptionService.calculateTrialEndDate()` usa 14 días. Cambiar a 7 días según la wiki.

2. **Card Tokenization:** El `card_token` se genera en el frontend con el SDK de MercadoPago. El backend solo recibe el `card_token_id` listo para enviar a MP.

3. **Suscripciones con plan asociado (2 pasos):** Consultar `references/mercadopago-subscriptions.md` para el flujo completo de `/preapproval_plan` + `/preapproval`, webhooks y card tokenization.

4. **MCP de MercadoPago:** Usar solo para consultas de documentación. La integración de pagos se realiza via REST API con `@mercadopago/sdk/rest`.

5. **Seguridad de Webhooks:** Siempre verificar la firma `x-mp-signature` antes de procesar. No confiar en datos de MP sin verificar.

6. **Staging de Suscripciones:** Usar entorno sandbox de MP para pruebas. Configurar `MERCADOPAGO_SANDBOX=true` en desarrollo.

7. **El plan TRIAL no tiene cobros recurrentes.** Solo crea `preapproval` temporal que expira en 7 días. Al vencer, el usuario debe elegir un plan de pago o la cuenta queda suspendida.