# 🗺️ Matriz de Trazabilidad de Requerimientos (RTM)

Este documento vincula los requerimientos funcionales con la lógica de negocio y los criterios de validación.

| ID Requerimiento | Nombre Funcional | Módulo Relacionado | Criterio de Aceptación (Validación) |
| :--- | :--- | :--- | :--- |
| **RF-01** | Instalación Custom App | Onboarding | App instalada y vinculada exitosamente a Shopify. |
| **RF-02** | Registro OAuth/Email | Onboarding | Usuario autenticado y sesión creada en la plataforma. |
| **RF-07 a RF-11** | Gestión de Conexiones | Conexiones | Solicitud enviada $\rightarrow$ Aceptada $\rightarrow$ Vínculo activo. |
| **RF-12 a RF-16** | Sincronización Productos | Sync Core | Atributos replicados vía SKU/Barcode en tienda destino. |
| **RF-17 a RF-19** | Sincronización Stock | Sync Core | Cambio en fuente se refleja en destino en $\le 10$s. |
| **RF-23 a RF-26** | Gestión de Pedidos | Operaciones | Pedido creado en destino $\rightarrow$ Replicado en fuente. |
| **RF-27 a RF-29** | Gestión de Pagos | Operaciones | Implementación de Revenue Splits y pagos automatizados. |
| **RF-37 a RF-40** | Marketplace Interno | Discovery | Tienda visible $\rightarrow$ Solicitud enviada desde Marketplace. |
| **RF-34 a RF-36** | Suscripciones | Admin | Pago procesado $\rightarrow$ Acceso a funcionalidades habilitado. |
| **RF-44 a RF-47** | Auditoría y Seguridad | Seguridad | Acción crítica registrada en logs con timestamp y usuario. |
