# Infrastructure - AWS SAM

Este directorio contiene la infraestructura AWS SAM para las funciones Lambda del módulo de suscripciones.

## Estructura

```
infra/sam/
├── template.yaml      # SAM template con las 4 funciones Lambda
├── events/             # Eventos de test para sam local invoke
│   ├── check-expirations.json
│   └── check-pending-payments.json
├── env.json            # Variables de entorno para SAM local
├── setup.sh            # Script de setup y verificación
└── README.md           # Este archivo
```

## Funciones Lambda

| Función | Schedule | Descripción |
|---------|----------|-------------|
| `CheckSubscriptionExpirations` | cron(0 0 * * ? *) | Marca trials expirados como EXPIRED |
| `CheckPendingPayments` | cron(0 8 * * ? *) | Verifica pagos pendientes > 48h |
| `CheckUpcomingBillingDates` | cron(0 9 * * ? *) | Envía recordatorios de cobro |
| `HandleOverduePayments` | cron(0 10 * * ? *) | Procesa suscripciones vencidas |

## Setup Local

```bash
# Dar permisos al script de setup
chmod +x infra/sam/setup.sh

# Ejecutar setup
./infra/sam/setup.sh

# Build de los packages
pnpm install
pnpm run build --filter=@shopify-sync/database
pnpm run build --filter=@shopify-sync/functions

# Verificar con SAM local
sam local invoke CheckSubscriptionExpirations \
  --event infra/sam/events/check-expirations.json \
  --env-vars infra/sam/env.json
```

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_HOST` | localhost | Host de PostgreSQL |
| `DATABASE_PORT` | 5432 | Puerto de PostgreSQL |
| `DATABASE_NAME` | shopify_sync | Nombre de la base de datos |
| `DATABASE_USER` | postgres | Usuario de PostgreSQL |
| `DATABASE_PASSWORD` | password | Contraseña de PostgreSQL |
| `NODE_ENV` | development | Entorno de ejecución |
| `AWS_SAM_LOCAL` | true | Flag para modo SAM local |

## Deployment

```bash
# Deployment a AWS
sam deploy --guided

# O usando parámetros
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name shopify-sync-functions \
  --parameter-overrides \
    DatabaseHost=your-db-host \
    DatabaseName=shopify_sync \
    DatabaseUser=postgres \
    NodeEnv=production
```

## Notas

- Las funciones usan CommonJS (`nodejs20.x`)
- Timeout: 30 segundos
- MemorySize: 128 MB
- No se usa TypeORMModule (Lambdas no tienen DI)
- DataSource se inicializa como singleton en cada Lambda cold start