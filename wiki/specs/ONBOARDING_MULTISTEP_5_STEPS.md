# Especificación: Flujo de Onboarding Multi-Step (5 Pasos)

## 1. Overview

### Objetivo
Implementar un flujo de onboarding de 5 pasos que permita a los usuarios configurar su cuenta SaaS multitenant de forma progresiva, con persistencia de estado entre sesiones y validación por pasos.

### MercadoPago MCP Server
**Sí existe y es usable.** El [MercadoPago MCP Server](https://www.mercadopago.com.co/developers/es/docs/mcp-server/overview) implementa el protocolo MCP (Model Context Protocol) para facilitar el acceso a las APIs de Mercado Pago desde agentes de IA o LLMs compatibles.

**Herramientas disponibles vía MCP:**
- `search_documentation` - Búsqueda en documentación de Mercado Pago
- Operaciones de pago (checkout-pro, subscriptions)

**Limitaciones detectadas:**
- El MCP Server está orientado a **AI agents**, no a uso directo desde código frontend/backend
- Para suscripciones recurrentes (subscriptions), es preferible usar la **REST API de Mercado Pago** directamente:
  - Planes: `POST /v1/preapproval_plan`
  - Suscripciones: `POST /v1/preapproval`
  - Pagos: `POST /v1/payments`

**Recomendación:** Usar el MCP de MercadoPago solo para consultas de documentación y ayuda. La integración de pagos se realiza via REST API con SDK `@mercadopago/sdk/rest`.

---

## 2. Estados del Onboarding

### Enum `OnboardingStatus` (extendido)

```typescript
export enum OnboardingStatus {
  // Paso 1: Empresa
  PENDING_TENANT_CONFIG = 'PENDING_TENANT_CONFIG',     // Nuevo: configurar empresa
  
  // Paso 2: Plan (antes PENDING_STORE_CONFIG)
  PENDING_PLAN_SELECTION = 'PENDING_PLAN_SELECTION',   // Selección de plan
  
  // Paso 3: Tienda (antes PENDING_STORE_ROLE)
  PENDING_STORE_CONFIG = 'PENDING_STORE_CONFIG',       // Configurar tienda
  
  // Paso 4: Rol de tienda (nuevo paso)
  PENDING_STORE_ROLE = 'PENDING_STORE_ROLE',           // Definir tipo de tienda
  
  // Paso 5: Equipo (era PENDING_TEAM_CONFIG)
  PENDING_TEAM_CONFIG = 'PENDING_TEAM_CONFIG',         // Invitar equipo
  
  // Completado
  COMPLETED = 'COMPLETED',
}
```

### Transiciones de Estado

```
PENDING_TENANT_CONFIG → PENDING_PLAN_SELECTION → PENDING_STORE_CONFIG → PENDING_STORE_ROLE → PENDING_TEAM_CONFIG → COMPLETED
```

---

## 3. Modelo de Datos (Extensiones)

### 3.1 Subscription (existente + extensiones)

```typescript
// Extensiones necesarias:
// - externalSubscriptionId: string (ID de suscripción en MercadoPago)
// - planId: string (ID del plan en MercadoPago)
// - billingPeriod: 'monthly' | 'yearly'
// - autoRecurrent: boolean

export enum SubscriptionPlan {
  TRIAL = 'TRIAL',
  BASIC = 'BASIC',
  PRO = 'PRO',           // NUEVO: agregar
  ENTERPRISE = 'ENTERPRISE', // NUEVO: agregar
}

// NUEVO: Plan pricing (para referencia)
export const PLAN_PRICING = {
  BASIC: { monthly: 29, yearly: 290 },
  PRO: { monthly: 79, yearly: 790 },
  ENTERPRISE: { monthly: 199, yearly: 1990 },
};

// Trial: máximo 7 días (no 14 como actualmente)
```

### 3.2 Store (existente)

```typescript
// El campo accessToken ya existe y está marcado como encrypted
// Solo se requiere agregar: shopName (nombre de la tienda para display)
```

### 3.3 TeamMember (extensiones)

```typescript
// Agregar a TeamMember:
export enum InvitationStatus {
  PENDING = 'PENDING',   // Invitación enviada, no aceptada
  ACCEPTED = 'ACCEPTED', // Usuario aceptó y creó cuenta
  EXPIRED = 'EXPIRED',   // Invitación vencida
}

@Entity('team_members')
export class TeamMember {
  // ... campos existentes ...
  
  @Column({ default: InvitationStatus.PENDING })
  invitationStatus: InvitationStatus;
  
  @Column({ default: false })
  isEnabled: boolean;  // false = inhibido de acceder
}
```

### 3.4 User (extensiones)

```typescript
// En User entity, separar companyName en tenant.name
// El campo tenant.name ya existe, no se necesita companyName redundante
```

---

## 4. Flujo de Pasos (Detalle)

### Paso 1: Configuración de Empresa (Tenant)

**Query Param:** `/onboarding?step=1`

**Lógica:**
- Usuario social (sin tenant): muestra input vacío, debe crear tenant
- Usuario con formulario (tenant ya creado con nombre): muestra nombre pre-diligenciado, editable
- Si el nombre ya existe, se actualiza; si no existe, se crea

**Endpoints Backend:**
```
POST   /api/onboarding/tenant     → Crear/actualizar tenant + crear subscription TRIAL
GET    /api/onboarding/tenant     → Obtener tenant actual
```

**Transición:** `PENDING_TENANT_CONFIG` → `PENDING_PLAN_SELECTION`

---

### Paso 2: Selección de Plan

**Query Param:** `/onboarding?step=2`

**Planes disponibles:**
| Plan | Mensual | Anual | Trial |
|------|---------|-------|-------|
| Basic | $29 | $290 | 7 días |
| Pro | $79 | $790 | 7 días |
| Enterprise | $199 | $1990 | 7 días |

**Comportamiento:**
- Si el usuario **no interactúa** con este paso (skip): se activa TRIAL 7 días
- Si el usuario **selecciona plan + paga**: crear suscripción real vía MercadoPago
- Si el usuario **selecciona plan sin pagar aún**: queda en estado PENDING_PAYMENT

**Flujo de pago MercadoPago:**

```
1. POST /api/onboarding/preference  → Crear preference de pago en MP
2. Backend devuelve: { preferenceId, initPoint }
3. Frontend redirige a: initPoint (URL de pago MP)
4. MercadoPago Webhook → POST /api/webhooks/mercadopago
5. Actualizar subscription con externalSubscriptionId
```

**Endpoints Backend:**
```
GET    /api/onboarding/plans                  → Lista de planes disponibles
POST   /api/onboarding/preference            → Crear preference de pago MP
GET    /api/onboarding/subscription/status    → Estado actual de suscripción
POST   /api/webhooks/mercadopago              → Callback de MP (IPN)
POST   /api/onboarding/subscription/skip      → Saltar y activar TRIAL
```

**Transición:** `PENDING_PLAN_SELECTION` → `PENDING_STORE_CONFIG`

---

### Paso 3: Configuración de Tienda (Shopify)

**Query Param:** `/onboarding?step=3`

**Campos:**
- `shopifyShopUrl`: URL de la tienda (ej: mi-tienda.myshopify.com)
- `shopifyAccessToken`: Token de la Custom App (se cifra en BD)

**Validaciones:**
- Conectar a Shopify API para verificar token válido
- Almacenar `shopifyShopId` (extraído de la API)

**Cifrado:**
- El `accessToken` se cifra usando `EncryptionUtil.encrypt()` antes de guardar
- Se descifra solo en memoria para uso en API calls a Shopify

**Endpoints Backend:**
```
POST   /api/onboarding/store/connect   → Validar token + guardar store
GET    /api/onboarding/store/status    → Verificar si store está conectada
```

**Transición:** `PENDING_STORE_CONFIG` → `PENDING_STORE_ROLE`

---

### Paso 4: Definir Tipo de Tienda

**Query Param:** `/onboarding?step=4`

**Opciones:**
- **Tienda origen (SOURCE)**: Proveedora de productos, envía inventario
- **Tienda destino (VENDOR)**: Recibe productos, recibe órdenes

**Endpoints Backend:**
```
POST   /api/onboarding/store/role      → Guardar rol seleccionado
```

**Transición:** `PENDING_STORE_ROLE` → `PENDING_TEAM_CONFIG`

---

### Paso 5: Invitar al Equipo

**Query Param:** `/onboarding?step=5`

**Funcionalidades:**
- Agregar usuario: nombre + email → crea TeamMember (invitationStatus: PENDING, isEnabled: false)
- Eliminar usuario agregado
- Editar usuario agregado
- Enviar correo de invitación (via Resend existente)

**Validaciones:**
- Email no debe existir en el tenant actual
- Email debe ser válido

**Endpoints Backend:**
```
GET    /api/onboarding/team                → Lista de invitaciones pendientes
POST   /api/onboarding/team/invite         → Crear invitación
DELETE /api/onboarding/team/:id            → Eliminar invitación
PUT    /api/onboarding/team/:id            → Editar invitación
POST   /api/onboarding/team/send-invites   → Enviar correos de invitación
```

**Transición:** `PENDING_TEAM_CONFIG` → `COMPLETED`

---

## 5. Página de Resumen

**Ruta:** `/onboarding/summary`

**Elementos:**
- Vista readonly de los 5 pasos completados
- Links para editar cada paso directamente (volver a `/onboarding?step=N`)
- Botón "Confirmar configuración"

**Al confirmar:**
```
POST /api/onboarding/complete
  → Actualizar Tenant.status = ACTIVE
  → Enviar correos de invitación a todos los TeamMember con invitationStatus PENDING
  → Redirigir a /dashboard
```

---

## 6. Navegación y Guardas

### Middleware/Guard de Onboarding

```typescript
// onbarding.guard.ts
// Verifica onboardingStatus del usuario en sesión

// Lógica:
// 1. Si onboardingStatus === COMPLETED → permitir acceso a /dashboard/*
// 2. Si onboardingStatus === PENDING_XXX → verificar que esté en el paso correcto
//    - URL /onboarding?step=3 pero status es PENDING_TENANT_CONFIG → redirigir a step=1
// 3. Si no está logueado → /auth/login
```

### Backend (`OnboardingGuard`)

El guard se aplica **por controller, no como `APP_GUARD` global**, porque hay endpoints que deben quedar exentos (webhooks de MercadoPago, login, refresh de token, etc).

Implementación: `apps/backend/src/application/auth/guards/onboarding.guard.ts`.

Rutas exentas por defecto (regex):
- `/api/auth/*` — login, register, refresh, social callbacks
- `/api/onboarding/*` — el propio flujo de onboarding
- `/api/webhooks/*` — webhooks externos (MercadoPago, etc)
- `/api/health` — healthchecks
- `/api/plans` — planes disponibles (público)

Para customizar los patrones exentos, usar el factory `OnboardingGuard.forRoot(patterns)`.

### Redirección post-login y post-callback

La redirección después del login depende de `onboardingStatus`, NO de `tenantId`.

| `onboardingStatus` | Redirect |
|--------------------|----------|
| `COMPLETED` y 1 tenant | `/dashboard` |
| `COMPLETED` y 2+ tenants | `/tenant-selector` |
| `PENDING_*` (cualquiera) | `/onboarding?step=N` (donde N = paso actual derivado del status) |

> ⚠️ **Importante:** un usuario con `tenantId` set (form-register crea tenant al registrarse) puede tener `onboardingStatus !== COMPLETED`. La heurística de "tiene tenant → dashboard" es incorrecta. La única señal de "puede ir al dashboard" es `onboardingStatus === COMPLETED`.

### Helpers de mapeo

`apps/backend/src/domain/enums/onboarding-status.enum.ts` exporta:
```typescript
ONBOARDING_STATUS_TO_STEP: Record<OnboardingStatus, number>
STEP_TO_ONBOARDING_STATUS: Record<number, OnboardingStatus>
TOTAL_ONBOARDING_STEPS = 5
```

El frontend debe tener un helper equivalente que derive el paso del `onboardingStatus` de la sesión.


### Query Params

- Cada paso tiene su query param: `?step=1`, `?step=2`, etc.
- Navigación directa permitida solo a:
  - Paso actual
  - Pasos ya completados
  - NO permite saltar a pasos no completados

---

## 7. APIs del Backend (Resumen)

### Endpoints de Onboarding

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/onboarding/status` | Estado del onboarding (paso actual + datos) |
| POST | `/api/onboarding/tenant` | Crear/actualizar empresa |
| GET | `/api/onboarding/tenant` | Obtener datos de empresa |
| GET | `/api/onboarding/plans` | Listar planes disponibles |
| POST | `/api/onboarding/preference` | Crear preference de pago MP |
| POST | `/api/onboarding/subscription/skip` | Activar trial 7 días |
| POST | `/api/onboarding/store/connect` | Conectar tienda Shopify |
| POST | `/api/onboarding/store/role` | Definir rol de tienda |
| GET | `/api/onboarding/team` | Listar invitaciones |
| POST | `/api/onboarding/team/invite` | Crear invitación |
| DELETE | `/api/onboarding/team/:id` | Eliminar invitación |
| PUT | `/api/onboarding/team/:id` | Editar invitación |
| POST | `/api/onboarding/team/send-invites` | Enviar correos |
| POST | `/api/onboarding/complete` | Finalizar onboarding |
| POST | `/api/webhooks/mercadopago` | Callback de MercadoPago |

---

## 8. Frontend (Estructura)

```
apps/frontend/app/(protected)/onboarding/
├── page.tsx                    # Redirect a step=1 si no hay query param
├── page.tsx?step=1             # Configurar empresa
├── page.tsx?step=2             # Seleccionar plan
├── page.tsx?step=3             # Configurar tienda
├── page.tsx?step=4             # Definir tipo de tienda
├── page.tsx?step=5             # Invitar equipo
└── summary/page.tsx            # Resumen y confirmación

components/onboarding/
├── OnboardingLayout.tsx        # Layout común (stepper + navegación)
├── Stepper.tsx                 # Componente visual de pasos
├── steps/
│   ├── Step1Company.tsx
│   ├── Step2Plan.tsx
│   ├── Step3Store.tsx
│   ├── Step4Role.tsx
│   └── Step5Team.tsx
└── Summary.tsx
```

---

## 9. Flujo Completo de Usuario

```
┌─────────────────────────────────────────────────────────────────┐
│ REGISTER (formulario)                                            │
│ POST /api/auth/register                                         │
│   → Crea User + Tenant + Subscription(TRIAL 7d)                 │
│   → Redirige a /onboarding?step=1                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ REGISTER (provider: Google/Facebook)                             │
│ OAuth callback → validateOrCreateSocialUser                      │
│   → Crea User (tenantId: null)                                  │
│   → Redirige a /onboarding?step=1                               │
│   (Paso 1 creará el tenant)                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ LOGIN                                                           │
│ POST /api/auth/login → JWT + NextAuth session                    │
│   → Sin tenants → /onboarding?step=1                             │
│   → 1 tenant → /dashboard                                        │
│   → 2+ tenants → /tenant-selector                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ONBOARDING FLOW                                                  │
│                                                                  │
│ step=1 → Completa empresa → POST /tenant → step=2               │
│ step=2 → Selecciona plan → Paga MP o skip → step=3              │
│ step=3 → Conecta Shopify → POST /store → step=4                 │
│ step=4 → Define rol SOURCE/VENDOR → step=5                       │
│ step=5 → Invita equipo → /summary                                │
│ summary → Confirma → /dashboard                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Notas de Implementación

### MercadoPago Integration
- Usar SDK: `@mercadopago/sdk/rest` o 直接 la REST API
- Suscripciones requieren `preapproval_plan` creado previamente en MP Dashboard
- Webhooks para confirmación de pago (IPN)
- Sandbox: `https://sandbox.mercadopago.com`

### Cifrado de Token Shopify
- Ya existe `EncryptionUtil` en backend
- Usar para cifrar `accessToken` antes de guardar en BD
- Descifrar solo en memoria para usar en llamadas API

### Trial Period
- **Cambiar de 14 a 7 días** en `SubscriptionService.calculateTrialEndDate()`

### TeamMember Invitations
- Usuarios invitados quedan con `isEnabled: false` hasta aceptar invitación
- El correo de invitación debe contener link con token para aceptar
- Endpoint de aceptación: `POST /api/onboarding/team/:id/accept?token=xxx`

### Validación de Pasos
- El `OnboardingGuard` debe verificar que el usuario esté en el paso correcto antes de permitir acceso
- Si intenta acceder a step=3 pero está en step=1 → redirigir a step=1