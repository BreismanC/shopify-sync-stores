# 🔄 Flujos de Negocio - shopify-sync-stored

Este documento describe los procesos operativos críticos del sistema, transformando los requerimientos funcionales en flujos lógicos de ejecución.

## 1. Flujo de Onboarding y Alta de Tenant

Este proceso asegura que el usuario esté correctamente configurado y categorizado antes de operar.

**Pasos:**
1. **Instalación:** El usuario instala la aplicación como **Custom App** en su panel de Shopify.
2. **Autenticación:** Registro mediante OAuth de Shopify o correo electrónico.
3. **Categorización:** El usuario selecciona su rol:
   - **Tienda Proveedora:** Ofrece productos a otros.
   - **Tienda Vendedora:** Importa productos de proveedores.
4. **Suscripción:** Selección de un plan de servicio (determina límites de productos y tiendas).
5. **Configuración:** Definición de usuarios y roles del equipo de trabajo.

### 1.1 Flujo de Autenticación y Creación de Tenant

El sistema maneja tres tipos de usuarios con lógica diferenciada:

#### Usuario Registrado por Formulario (Email/Password)

```
[Usuario] → Formulario de registro
    → POST /auth/register
       - Crea Tenant con companyName
       - Crea Subscription TRIAL
       - Crea User con tenantId
    → Login exitoso → /dashboard (ya tiene tenant)
```

#### Usuario Registrado por OAuth (Google/Facebook)

```
[Usuario] → Click "Login con Google/Facebook"
    → GET /auth/google → OAuth → /auth/google/callback
       - validateOrCreateSocialUser() → User con tenantId: null
       - El usuario NO tiene tenant aún
    → Login exitoso → /onboarding
       - Usuario ingresa nombre de empresa
       - POST /auth/tenant → Upsert crea Tenant + Subscription TRIAL
    → Onboarding completado → /dashboard
```

#### Usuario con Múltiples Tenants

```
[Usuario] → Login/registro
    → Sistema detecta múltiples tenants
    → /tenant-selector
       - Usuario selecciona con cuál tenant trabajar
    → Redirect → /dashboard (con tenant activo seleccionado)
```

### 1.2 Estados del Onboarding

| Estado | Descripción |
|--------|-------------|
| `PENDING_STORE_CONFIG` | Esperando configuración de empresa (Tenant) |
| `PENDING_STORE_ROLE` | Esperando conexión de tienda Shopify |
| `PENDING_TEAM_CONFIG` | Esperando configuración de equipo |
| `COMPLETED` | Onboarding finalizado, acceso completo |

### 1.3 Reglas de Redirección

| Tipo de Usuario | Condición | Redirección |
|-----------------|-----------|-------------|
| Formulario | Login exitoso | `/dashboard` |
| OAuth (Google/Facebook) | Login exitoso, sin tenant | `/onboarding` |
| OAuth + Formulario | Onboarding completado | `/dashboard` |
| Multi-tenant | >1 tenant disponible | `/tenant-selector` |

## 2. Flujo de Establecimiento de Conexiones

El mecanismo para vincular dos tiendas independientes bajo un acuerdo comercial.

**Camino A: Invitación Directa**
`Proveedor/Vendedor` $\rightarrow$ Envía solicitud vía email $\rightarrow$ `Receptor` $\rightarrow$ Acepta/Rechaza $\rightarrow$ Vínculo Activo.

**Camino B: Marketplace Interno**
`Vendedor` $\rightarrow$ Explora Marketplace $\rightarrow$ Filtra por categoría/reputación $\rightarrow$ Solicita conexión $\rightarrow$ `Proveedor` $\rightarrow$ Acepta/Rechaza $\rightarrow$ Vínculo Activo.

## 3. Flujo de Sincronización de Catálogo (Core)

El proceso de replicar productos desde la fuente hacia la tienda destino.

**Pasos:**
1. **Configuración de Reglas:** El usuario define qué atributos sincronizar (Ej: Precio $\rightarrow$ Sí, Descripción $\rightarrow$ No).
2. **Disparador (Trigger):**
   - **Automático:** Basado en eventos de Shopify (Webhooks) o frecuencia programada (Cron).
   - **Manual:** Acción explícita del usuario desde el panel.
3. **Procesamiento:** El backend recupera la información de la tienda fuente y la formatea según las reglas.
4. **Ejecución:** Actualización de la tienda destino vía API de Shopify.
5. **Trazabilidad:** Registro del evento en el **Centro de Actividades** (Éxito/Error).

## 4. Flujo de Sincronización de Inventario y Pedidos

Garantiza la coherencia del stock y la gestión de ventas.

**Sincronización de Stock:**
`Cambio de Stock en Fuente` $\rightarrow$ `Evento de Sincronización` $\rightarrow$ `Actualización inmediata en todas las Tiendas Destino vinculadas` $\rightarrow$ `Prevención de Sobreventa`.

**Sincronización de Pedidos:**
`Venta en Tienda Destino` $\rightarrow$ `Sincronización de Orden a Tienda Fuente` $\rightarrow$ `Cálculo de Comisión` $\rightarrow$ `Notificación al Proveedor` $\rightarrow$ `Gestión de Envío`.

## 5. Flujo de Pagos y Comisiones

Cierre del ciclo financiero entre los actores.

**Pasos:**
1. **Detección de Pago:** Sincronización del estado del pago del pedido.
2. **Cálculo:** El sistema aplica la regla de comisión definida para esa conexión.
3. **Registro:** Actualización del historial de pagos y saldos en el panel administrativo.
4. **Liquidación:** Gestión de cobros recurrentes de suscripción vía MercadoPago.

## 6. Flujo de Suscripción y Trial

El sistema maneja el ciclo de vida completo de las suscripciones desde el registro hasta la renovación automática.

### 6.1 Flujo de Registro → Trial → Suscripción Activa

```
[Usuario registra cuenta]
    → Crea Tenant + Subscription TRIAL (7 días)
    → Trial con estado ACTIVE
    ↓
[Día 1-7: Periodo de prueba]
    → Usuario explora funcionalidades (límites: 1 conexión, 1 tienda)
    ↓ (si no upgrdea antes del día 7)
[Día 7: Expiración del Trial]
    → Cron marca subscription como EXPIRED
    → Usuario pierde acceso a features premium
    → Se envía email recordatorio de expiración
```

### 6.2 Flujo de Selección de Plan → Pago MercadoPago

```
[Usuario en dashboard con TRIAL expirado o activo]
    → Navega a /subscription/plans
    → Selecciona plan (BASIC/PRO/ENTERPRISE) y periodo (MONTHLY/YEARLY)
    → Frontend obtiene card_token via SDK MercadoPago
    ↓
[POST /api/subscriptions/create-preapproval]
    → Backend crea preapproval en MP con card_token_id
    → MP procesa primer cobro + guarda payment_method
    → Devuelve initPoint al frontend
    ↓
[Usuario redirigido a MercadoPago]
    → Paga (o abandona)
    ↓
[Webhook IPN recibe notificación]
    → MP notifica estado del preapproval
    → Backend actualiza: externalSubscriptionId, status=ACTIVE
    → Backend configura autoRecurrent=true, nextBillingDate
    ↓
[Suscripción activa]
    → Límites del plan aplicados (conexiones, tiendas, usuarios)
    → Renovación automática según billingPeriod
```

### 6.3 Flujo de Cobro Automático (Auto-Recurrent)

```
[Cron: cada día a las 9 AM]
    → Consulta suscripciones con nextBillingDate en 3 días
    → Envía email recordatorio de cobro próximo
    ↓
[Fecha de cobro llega]
    → MercadoPago ejecuta cargo automáticamente
    → payment_method guardado usado
    ↓
[Si cobro exitoso]
    → MP envía webhook payment success
    → Backend actualiza lastBillingDate
    → Backend calcula nextBillingDate según billingPeriod
    → amountPaid se incrementa
    ↓
[Si cobro falla]
    → MP envía webhook payment failure
    → Backend: attempts += 1
    → Si attempts < 3: reintento en 3 días
    → Si attempts >= 3: status=SUSPENDED
    → Envía email de notificación de pago fallido
```

### 6.4 Flujo de Upgrade de Plan

```
[Usuario con plan BASIC activo]
    → Navega a /subscription/upgrade
    → Selecciona plan PRO (mayor precio)
    → Selecciona nuevo billingPeriod
    ↓
[POST /api/subscriptions/upgrade]
    → Backend crea nuevo preapproval en MP
    → Usuario paga la diferencia proporcional
    → Al confirmar: status=PENDING_PAYMENT
    ↓
[Webhook: nuevo pago confirmado]
    → Backend cancela old preapproval en MP
    → Actualiza subscription: planType=PRO, status=ACTIVE
    → Recalcula límites según nuevo plan
```

### 6.5 Flujo de Cancelación

```
[Usuario decide cancelar]
    → Navega a /subscription/cancel
    → Selecciona razón (USER_REQUEST, PAYMENT_FAILED, BILLING_CYCLE_END)
    → Confirma cancelación
    ↓
[POST /api/subscriptions/cancel]
    → Backend: autoRecurrent=false
    → Backend: PUT /v1/preapprovals/{id} status=cancelled
    → Backend: status=CANCELED
    → Envía email de confirmación de cancelación
    ↓
[Suscripción cancelada]
    → Acceso continúa hasta fin del periodo pagado
    → Al final: límites bajan a 0 (sin acceso)
    → Datos se retienen por 90 días
```

### 6.6 Estados y Transiciones de Suscripción

| Estado Actual | Evento | Estado Siguiente |
|--------------|--------|-----------------|
| PENDING_PAYMENT | Pago completado | ACTIVE |
| PENDING_PAYMENT | Expiró (7 días sin pago) | EXPIRED |
| TRIAL | Trial expiró (7 días) | EXPIRED |
| TRIAL | Upgrade a plan | PENDING_PAYMENT |
| ACTIVE | Cobro exitoso | ACTIVE (renueva) |
| ACTIVE | 3 cobros fallidos | SUSPENDED |
| ACTIVE | Usuario cancela | CANCELED |
| SUSPENDED | Paga deuda | ACTIVE |
| SUSPENDED | 90 días sin pagar | CANCELED |

## 7. Límites por Plan

| Plan | Conexiones | Tiendas | Usuarios equipo | Features |
|------|-----------|---------|-----------------|----------|
| TRIAL | 1 | 1 | 0 | Solo lectura de catalog |
| BASIC | 3 | 2 | 3 | Sync inventory |
| PRO | 10 | 5 | 10 | Sync inventory + orders + marketplace |
| ENTERPRISE | ∞ | ∞ | ∞ | Todo + soporte prioritario |