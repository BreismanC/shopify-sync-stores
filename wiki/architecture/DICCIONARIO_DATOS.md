# 📖 Diccionario de Datos y Glosario Técnico

Este documento define la nomenclatura estándar para el desarrollo del sistema, evitando ambigüedades entre el equipo de frontend y backend.

## 1. Entidades Principales

### 🏢 Tenant (Organización)

Representa la cuenta de cliente que contrata el SaaS. Es la entidad de más alto nivel en el modelo multi-tenant.

- `id` (UUID): Identificador único.
- `name` (String): Nombre de la empresa/organización.
- `status` (Enum: `ACTIVE`, `SUSPENDED`, `TRIAL`): Estado de la cuenta.
- `createdAt` (Timestamp): Fecha de creación.
- `updatedAt` (Timestamp): Última modificación.

### 👤 User (Usuario)

Representa a un usuario individual del sistema. Puede o no tener un `tenantId` asignado (los usuarios sociales empiezan sin tenant).

- `id` (UUID): Identificador único.
- `tenantId` (UUID, **nullable**): FK hacia Tenant. Null para usuarios sociales que aún no completaron onboarding.
- `email` (String, unique): Correo electrónico del usuario.
- `password` (String, nullable): Contraseña hasheada. Null para usuarios OAuth.
- `name` (String): Nombre completo del usuario.
- `companyName` (String, nullable): Nombre de la empresa (ingresado en el registro o en onboarding).
- `role` (Enum: `OWNER`, `ADMIN`, `MEMBER`): Rol del usuario dentro del tenant.
- `onboardingStatus` (Enum): Estado del proceso de onboarding.
- `createdAt` (Timestamp): Fecha de creación.
- `updatedAt` (Timestamp): Última modificación.

### 🏪 Store (Tienda Shopify)

Representa una instancia de tienda de Shopify vinculada a un tenant.

- `id` (UUID): Identificador interno.
- `tenantId` (UUID, FK): Relación con la organización.
- `shopifyShopId` (String, unique): ID de la tienda en Shopify.
- `accessToken` (String, encrypted): Token de API para comunicación con Shopify.
- `role` (Enum: `SOURCE`, `VENDOR`): Rol de la tienda en las sincronizaciones.
- `isActive` (Boolean): Si la tienda está activa.
- `createdAt` (Timestamp): Fecha de creación.
- `updatedAt` (Timestamp): Última modificación.

### 📋 Subscription (Suscripción)

Gestión del plan y trial del tenant.

- `id` (UUID): Identificador único.
- `tenantId` (UUID, FK): Relación con la organización.
- `planType` (Enum: `TRIAL`, `BASIC`, `PRO`, `ENTERPRISE`): Tipo de plan.
- `status` (Enum: `ACTIVE`, `EXPIRED`, `CANCELED`, `PENDING_PAYMENT`, `SUSPENDED`): Estado de la suscripción.
- `startDate` (Timestamp): Fecha de inicio.
- `trialEndDate` (Timestamp): Fecha de fin del trial (para TRIAL).
- `externalSubscriptionId` (String, nullable): ID de suscripción en MercadoPago (preapproval id).
- `externalPlanId` (String, nullable): ID del plan en MercadoPago (preapproval_plan id).
- `billingPeriod` (Enum: `MONTHLY`, `YEARLY`): Periodo de facturación.
- `autoRecurrent` (Boolean): Si la suscripción se renueva automáticamente.
- `lastBillingDate` (Timestamp, nullable): Última fecha de cobro.
- `nextBillingDate` (Timestamp, nullable): Próxima fecha de cobro.
- `paymentMethodId` (String, nullable): ID del método de pago guardado en MP.
- `amountPaid` (Decimal): Monto total pagado histórico.
- `createdAt` (Timestamp): Fecha de creación.
- `updatedAt` (Timestamp): Última modificación.

### 🔗 Connection (Vínculo)

Define la relación de sincronización entre dos tiendas.

- `id` (UUID): Identificador único.
- `sourceStoreId` (FK): Referencia a la tienda proveedora.
- `destStoreId` (FK): Referencia a la tienda suscriptora.
- `status` (Enum: `PENDING`, `ACTIVE`, `CANCELLED`): Estado del vínculo.
- `commissionRate` (Decimal): Porcentaje de comisión acordado.
- `createdAt` (Timestamp): Fecha de creación.
- `updatedAt` (Timestamp): Última modificación.

### 📦 Product (Producto Sincronizado)

Representa el producto y sus atributos replicados.

- `id` (UUID): Identificador interno.
- `shopifyProductId` (String): ID original en Shopify.
- `tenantId` (UUID, FK): Relación con la organización.
- `title` (String): Nombre del producto.
- `price` (Decimal): Precio actual.
- `stockLevel` (Integer): Cantidad disponible.
- `syncRules` (JSON): Atributos a incluir/excluir.
- `createdAt` (Timestamp): Fecha de creación.
- `updatedAt` (Timestamp): Última modificación.

### 🛒 Order (Pedido)

Representa la orden de venta sincronizada.

- `id` (UUID): Identificador interno.
- `shopifyOrderId` (String): ID de la orden en Shopify.
- `tenantId` (UUID, FK): Relación con la organización.
- `totalAmount` (Decimal): Monto total del pedido.
- `commissionAmount` (Decimal): Valor de la comisión calculada.
- `status` (Enum: `PROCESSING`, `SHIPPED`, `COMPLETED`): Estado del pedido.
- `createdAt` (Timestamp): Fecha de creación.
- `updatedAt` (Timestamp): Última modificación.

### 📜 SyncLog (Trazabilidad)

Registro de cada evento de sincronización.

- `id` (UUID): Identificador único.
- `tenantId` (UUID, FK): Relación con la organización.
- `entityType` (Enum: `PRODUCT`, `STOCK`, `ORDER`): Qué se sincronizó.
- `status` (Enum: `SUCCESS`, `FAILED`): Resultado.
- `errorMessage` (String): Detalle del error si falló.
- `timestamp` (Timestamp): Fecha y hora del evento.

### 👥 TeamMember (Miembro de Equipo)

Vincula usuarios a tenants con roles específicos.

- `id` (UUID): Identificador único.
- `tenantId` (UUID, FK): Relación con la organización.
- `userId` (UUID, FK): Relación con el usuario.
- `role` (String): Rol dentro del equipo.

## 2. Enumeraciones

### OnboardingStatus

Estados del proceso de onboarding del usuario:

| Valor | Descripción |
|-------|-------------|
| `PENDING_STORE_CONFIG` | Esperando configuración de empresa (Tenant) |
| `PENDING_STORE_ROLE` | Esperando conexión de tienda Shopify |
| `PENDING_TEAM_CONFIG` | Esperando configuración de equipo |
| `COMPLETED` | Onboarding finalizado |

### UserRole

Roles posibles dentro de un tenant:

| Valor | Descripción |
|-------|-------------|
| `OWNER` | Propietario de la cuenta (plenos poderes) |
| `ADMIN` | Administrador (gestión de usuarios y configuración) |
| `MEMBER` | Miembro básico (solo lectura y uso limitado) |

### StoreRole

Rol de la tienda en el sistema de sincronización:

| Valor | Descripción |
|-------|-------------|
| `SOURCE` | Tienda proveedora (exporta productos) |
| `VENDOR` | Tienda vendedora (importa productos) |

### SubscriptionStatus

Estados de la suscripción:

| Valor | Descripción |
|-------|-------------|
| `ACTIVE` | Suscripción activa |
| `EXPIRED` | Suscripción expirada |
| `CANCELED` | Suscripción cancelada |
| `PENDING_PAYMENT` | Plan seleccionado pero sin pago |
| `SUSPENDED` | Pago fallido o vencido |

### SubscriptionPlan

Planes disponibles:

| Valor | Descripción |
|-------|-------------|
| `TRIAL` | Periodo de prueba (7 días) |
| `BASIC` | Plan básico ($29/mes o $290/año) |
| `PRO` | Plan profesional ($79/mes o $790/año) |
| `ENTERPRISE` | Plan enterprise ($199/mes o $1990/año) |

### BillingPeriod

Periodo de facturación:

| Valor | Descripción |
|-------|-------------|
| `MONTHLY` | Facturación mensual |
| `YEARLY` | Facturación anual (descuento) |

### TenantStatus

Estados del tenant:

| Valor | Descripción |
|-------|-------------|
| `ACTIVE` | Tenant activo |
| `SUSPENDED` | Tenant suspendido |
| `TRIAL` | En periodo de prueba |

## 3. Glosario de Términos

- **Custom App:** Aplicación de Shopify instalada manualmente mediante tokens de acceso, sin pasar por el App Store público.
- **Multitenancy:** Arquitectura donde una sola instancia del software sirve a múltiples clientes independientes. Cada tenant tiene sus propios datos aislados.
- **Event-Driven:** Diseño basado en eventos (Webhooks de Shopify → Colas de BullMQ → Actualización de DB).
- **Sincronización Bidireccional:** Capacidad de actualizar datos en ambas direcciones (aunque el core es Fuente → Destino).
- **Upsert:** Operación que crea un nuevo registro o actualiza uno existente si ya existe. Se usa en la creación de tenant desde el onboarding.
- **OAuth (Social Auth):** Autenticación mediante proveedores externos como Google o Facebook. El usuario social se crea con `tenantId: null`.
- **Onboarding:** Proceso de configuración inicial que el usuario debe completar después del registro.

## 4. Modelo de Relaciones

```
Tenant (1) ─── (N) User
    │
    ├── (1) Subscription
    │
    ├── (1) Store
    │
    └── (N) TeamMember ─── (N) User
            │
            └── (N) Connection ─── (2) Store
```

**Nota importante:** El `User.tenantId` es nullable. Esto permite que:
1. Usuarios registrados por formulario tengan `tenantId` inmediatamente (creado en registro).
2. Usuarios sociales (OAuth) tengan `tenantId: null` hasta que completen el onboarding y creen su tenant via upsert.