# 🔍 Análisis de Referente: Syncio

## 1. Propuesta de Valor
Syncio se posiciona como el estándar de sincronización para Shopify, enfocándose en la **precisión absoluta del inventario** para evitar el *overselling*. Su valor reside en la capacidad de conectar tiendas proveedoras y suscriptoras de manera transparente.

## 2. Funcionalidades Críticas Identificadas
- **Sincronización por SKU/Barcode:** No dependen de IDs internos de Shopify, sino de identificadores universales (SKU), permitiendo la interoperabilidad entre distintas tiendas.
- **Atributos Selectivos:** El usuario elige exactamente qué campos sincronizar (Precio, Tags, Imágenes, etc.).
- **Revenue Splits:** Gestión de comisiones donde el pago se divide automáticamente entre proveedor y vendedor.
- **Marketplace de Descubrimiento:** Directorio interno para facilitar la creación de nuevas conexiones comerciales.
- **Sincronización Multi-Location:** Soporte para inventarios distribuidos en múltiples bodegas físicas.

## 3. Oportunidades de Mejora para Nuestro Proyecto
- **Onboarding Simplificado:** Syncio puede ser complejo de configurar; nuestra implementación de *Custom Apps* y un flujo guiado puede ser un diferenciador.
- **Sincronización Basada en Eventos:** Optimizar el tiempo de respuesta la $\le 10$ segundos usando una arquitectura de colas más agresiva.
- **Reglas de Negocio Granulares:** Implementar triggers de sincronización basados en condiciones lógicas más complejas.
