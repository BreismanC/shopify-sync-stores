# 📐 Arquitectura Serverless - Funciones Lambda

Este documento describe la arquitectura serverless del módulo de suscripciones utilizando AWS Lambda y AWS SAM para cron jobs de billing.

## 1. Visión General

Las funciones Lambda manejan tareas periódicas relacionadas con el ciclo de vida de las suscripciones: verificación de expiraciones, cobros pendientes, recordatorios de facturación y manejo de pagos vencidos.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AWS Cloud                                     │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ check-expirations│    │check-pending-   │    │check-upcoming-  │  │
│  │  Lambda         │    │  payments       │    │  billing        │  │
│  │  (midnight UTC) │    │  Lambda         │    │  Lambda         │  │
│  └────────┬────────┘    │  (8 AM UTC)     │    │  (9 AM UTC)     │  │
│           │              └────────┬────────┘    └────────┬────────┘  │
│           │                       │                      │          │
│           └───────────────────────┼──────────────────────┘          │
│                                   │                                  │
│                          ┌────────▼────────┐                        │
│                          │   PostgreSQL    │                        │
│                          │   shopify_sync  │                        │
│                          └─────────────────┘                        │
│                                                                      │
│  ┌─────────────────┐                                                │
│  │handle-overdue   │    ┌─────────────────┐                        │
│  │Lambda           │    │   MercadoPago   │                        │
│  │(10 AM UTC)      │───▶│   API            │                        │
│  └─────────────────┘    └─────────────────┘                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Funciones Lambda

### 2.1 CheckSubscriptionExpirations

**Schedule:** `cron(0 0 * * ? *)` - Cada día a medianoche UTC

**Responsabilidad:** Marcar suscripciones TRIAL expiradas como EXPIRED y notificar a usuarios.

**Handler:** `dist/subscription/check-expirations.handler`

**Lógica:**
```typescript
// 1. Buscar suscripciones TRIAL con trialEndDate < now
// 2. Actualizar status = EXPIRED para cada una
// 3. Enviar email de notificación al tenant
// 4. Registrar en SyncLog la acción
```

**Evento de test:**
```json
{
  "action": "check-expirations"
}
```

### 2.2 CheckPendingPayments

**Schedule:** `cron(0 8 * * ? *)` - Cada día a las 8 AM UTC

**Responsabilidad:** Verificar suscripciones en estado PENDING_PAYMENT que llevan más de 48 horas sin completar el pago.

**Handler:** `dist/subscription/check-pending-payments.handler`

**Lógica:**
```typescript
// 1. Buscar suscripciones PENDING_PAYMENT con createdAt < now - 48h
// 2. Enviar recordatorio por email
// 3. Si createdAt < now - 7 días: marcar como EXPIRED
```

### 2.3 CheckUpcomingBillingDates

**Schedule:** `cron(0 9 * * ? *)` - Cada día a las 9 AM UTC

**Responsabilidad:** Enviar recordatorios de cobro a usuarios con próxima facturación en 3 días.

**Handler:** `dist/subscription/check-upcoming-billing.handler`

**Lógica:**
```typescript
// 1. Buscar suscripciones ACTIVE con nextBillingDate en los próximos 3 días
// 2. Para cada una: enviar email recordatorio con monto y fecha
// 3. Registrar envío en logs
```

### 2.4 HandleOverduePayments

**Schedule:** `cron(0 10 * * ? *)` - Cada día a las 10 AM UTC

**Responsabilidad:** Procesar suscripciones con pagos vencidos, intentando cobros y manejando suspensiones.

**Handler:** `dist/subscription/handle-overdue.handler`

**Lógica:**
```typescript
// 1. Buscar suscripciones ACTIVE con nextBillingDate < now - 3 días
// 2. Notificar al usuario (primer vencimiento)
// 3. Si nextBillingDate < now - 7 días: marcar como SUSPENDED
// 4. Si nextBillingDate < now - 90 días: marcar como CANCELED
// 5. Para SUSPENDED con payment_method: reintentar cobro via MercadoPago
```

## 3. Configuración SAM

### 3.1 Template (template.yaml)

El archivo `infra/sam/template.yaml` define las 4 funciones Lambda con sus triggers de EventBridge.

**Configuración global:**
- Runtime: `nodejs20.x`
- Timeout: 30 segundos
- MemorySize: 128 MB
- Environment variables: DATABASE_*, NODE_ENV, AWS_SAM_LOCAL

### 3.2 Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_HOST` | localhost | Host de PostgreSQL |
| `DATABASE_PORT` | 5432 | Puerto de PostgreSQL |
| `DATABASE_NAME` | shopify_sync | Nombre de la base de datos |
| `DATABASE_USER` | postgres | Usuario de PostgreSQL |
| `DATABASE_PASSWORD` | password | Contraseña de PostgreSQL |
| `NODE_ENV` | development | Entorno de ejecución |
| `AWS_SAM_LOCAL` | false | Flag para detectar modo local |
| `MERCADOPAGO_ACCESS_TOKEN` | — | Token de producción de MP |
| `MERCADOPAGO_SANDBOX` | false | Modo sandbox |
| `INTERNAL_API_KEY` | — | API key para llamadas internas |
| `RESEND_API_KEY` | — | API key de Resend para emails |

### 3.3 Desarrollo Local con SAM

**Requisitos:**
- AWS SAM CLI instalado
- Docker (para sam local invoke)
- PostgreSQL local ejecutándose

**Setup:**
```bash
# 1. Configurar variables de entorno
cp infra/sam/env.json.example infra/sam/env.json
# Editar env.json con credenciales locales

# 2. Build de packages
pnpm install
pnpm run build --filter=@shopify-sync/database
pnpm run build --filter=@shopify-sync/functions

# 3. Invocar función localmente
sam local invoke CheckSubscriptionExpirations \
  --event infra/sam/events/check-expirations.json \
  --env-vars infra/sam/env.json

# 4. Desarrollar con watch (reconstruye automáticamente)
sam local start-api
```

**Estructura de eventos de test:**
```
infra/sam/events/
├── check-expirations.json      # Test para check-expirations
├── check-pending-payments.json # Test para check-pending-payments
├── check-upcoming-billing.json # Test para check-upcoming-billing
└── handle-overdue.json        # Test para handle-overdue
```

## 4. Arquitectura de Datos en Lambdas

A diferencia del backend NestJS que usa TypeORM con DI, las Lambdas inicializan el DataSource manualmente:

```typescript
// apps/functions/src/subscription/check-expirations.ts
import { DataSource } from 'typeorm';
import { Subscription } from '@shopify-sync/database';

let dataSource: DataSource;

async function initDataSource(): Promise<DataSource> {
  if (!dataSource) {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [Subscription],
      synchronize: false,
    });
    await dataSource.initialize();
  }
  return dataSource;
}

export const handler = async (event: any) => {
  const ds = await initDataSource();
  const repo = ds.getRepository(Subscription);
  
  // Lógica de la Lambda...
};
```

## 5. Flujo de Datos

```
[MercadoPago Webhook]
        │
        ▼
┌───────────────────┐
│  NestJS Backend   │◀── Webhook handler actualiza subscription
│  (API Gateway)    │
└────────┬──────────┘
         │ actualiza nextBillingDate, lastBillingDate, amountPaid
         ▼
┌───────────────────┐
│   PostgreSQL      │
│  subscriptions    │
└────────┬──────────┘
         │
         │ consulta diariamente
         ▼
┌─────────────────────────────────────────────────┐
│  AWS EventBridge (Cron triggers)                │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│  │ 12:00 UTC   │ │ 08:00 UTC   │ │ 09:00 UTC  ││
│  │ check-exp   │ │ check-pend │ │ check-upc  ││
│  └──────┬──────┘ └──────┬──────┘ └─────┬──────┘│
│         │               │              │       │
│         └───────────────┼──────────────┘       │
│                         ▼                      │
│              ┌────────────────────┐           │
│              │  Lambda Functions  │           │
│              └─────────┬──────────┘           │
│                        │                      │
│                        ▼                      │
│              ┌────────────────────┐           │
│              │  MercadoPago API   │           │
│              │  (reintentos, info) │           │
│              └────────────────────┘           │
└─────────────────────────────────────────────────┘
```

## 6. Modelos de Suscripción en la Base de Datos

### 6.1 Campos Clave para Cron Jobs

```sql
-- Suscripciones activas con próxima facturación
SELECT * FROM subscriptions 
WHERE status = 'ACTIVE' 
AND autoRecurrent = true 
AND nextBillingDate <= NOW() + INTERVAL '3 days';

-- Trials expirados
SELECT * FROM subscriptions 
WHERE planType = 'TRIAL' 
AND status = 'ACTIVE' 
AND trialEndDate < NOW();

-- Pagos pendientes vencidos
SELECT * FROM subscriptions 
WHERE status = 'PENDING_PAYMENT' 
AND createdAt < NOW() - INTERVAL '7 days';

-- Suspensiones por cobrar
SELECT * FROM subscriptions 
WHERE status = 'SUSPENDED';
```

## 7. Integración con Resend (Emails)

Cada Lambda puede enviar emails transaccionales via Resend:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendExpirationEmail(tenantEmail: string, tenantName: string) {
  await resend.emails.send({
    from: 'billing@shopify-sync.com',
    to: tenantEmail,
    subject: 'Tu trial ha expirado',
    html: `
      <h1>Hola ${tenantName}</h1>
      <p>Tu periodo de prueba ha finalizado.</p>
      <p>Para continuar usando Shopify Sync, selecciona un plan.</p>
    `,
  });
}
```

## 8. Notas de Producción

- **Cold Start:** Las Lambdas pueden tardar ~3-5 segundos en inicializar el DataSource la primera vez. Considerar provisioned concurrency para producción.
- **Errores:** Si una Lambda falla, EventBridge reintentará según la configuración del schedule. Ver logs en CloudWatch.
- **Costos:** Con ejecución diaria (~4 invocaciones/día), el costo es mínimo. Bajo tráfico, menos de $1/month.
- **Regiones:** Deployar en la misma región que la base de datos PostgreSQL para minimizar latencia.