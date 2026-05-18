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
