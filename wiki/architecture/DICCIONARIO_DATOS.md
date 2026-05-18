# 📖 Diccionario de Datos y Glosario Técnico

Este documento define la nomenclatura estándar para el desarrollo del sistema, evitando ambigüedades entre el equipo de frontend y backend.

## 1. Entidades Principales

### 🏢 Tenant (Organización)
Representa la cuenta de cliente que contrata el SaaS.
- `tenant_id` (UUID): Identificador único.
- `plan_type`: Tipo de suscripción (Basic, Pro, Enterprise).
- `status`: Estado de la cuenta (Active, Suspended, Trial).

### 🏪 Store (Tienda Shopify)
Representa una instancia de tienda de Shopify vinculada.
- `store_id` (UUID): Identificador interno.
- `shopify_domain`: Dominio de la tienda (`.myshopify.com`).
- `access_token`: Token de API para comunicación con Shopify.
- `store_role`: Rol de la tienda (`SOURCE` o `DESTINATION`).
- `tenant_id` (FK): Relación con la organización.

### 🔗 Connection (Vínculo)
Define la relación de sincronización entre dos tiendas.
- `connection_id` (UUID): Identificador único.
- `source_store_id` (FK): Referencia a la tienda proveedora.
- `dest_store_id` (FK): Referencia a la tienda suscriptora.
- `status`: Estado del vínculo (`PENDING`, `ACTIVE`, `CANCELLED`).
- `commission_rate`: Porcentaje de comisión acordado.

### 📦 Product (Producto Sincronizado)
Representa el producto y sus atributos replicados.
- `product_id` (UUID): Identificador interno.
- `shopify_product_id`: ID original en Shopify.
- `title`: Nombre del producto.
- `price`: Precio actual.
- `stock_level`: Cantidad disponible.
- `sync_rules`: JSON con atributos a incluir/excluir.

### 🛒 Order (Pedido)
Representa la orden de venta sincronizada.
- `order_id` (UUID): Identificador interno.
- `shopify_order_id`: ID de la orden en Shopify.
- `total_amount`: Monto total del pedido.
- `commission_amount`: Valor de la comisión calculada.
- `status`: Estado del pedido (`PROCESSING`, `SHIPPED`, `COMPLETED`).

### 📜 SyncLog (Trazabilidad)
Registro de cada evento de sincronización.
- `log_id` (UUID): Identificador único.
- `entity_type`: Qué se sincronizó (`PRODUCT`, `STOCK`, `ORDER`).
- `status`: Resultado (`SUCCESS`, `FAILED`).
- `error_message`: Detalle del error si falló.
- `timestamp`: Fecha y hora del evento.

## 2. Glosario de Términos
- **Custom App:** Aplicación de Shopify instalada manualmente mediante tokens de acceso, sin pasar por el App Store público.
- **Multitenancy:** Arquitectura donde una sola instancia del software sirve a múltiples clientes independientes.
- **Event-Driven:** Diseño basado en eventos (Webhooks de Shopify $\rightarrow$ Colas de BullMQ $\rightarrow$ Actualización de DB).
- **Sincronización Bidireccional:** Capacidad de actualizar datos en ambas direcciones (aunque el core es Fuente $\rightarrow$ Destino).
