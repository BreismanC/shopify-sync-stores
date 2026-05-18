# 🕷️ Especificación de Extracción de Datos (Scraping Guide) - Syncio

## 1. Objetivo de la Tarea
Realizar una ingeniería inversa de la oferta comercial, técnica y operativa de la plataforma **Syncio**, extrayendo datos estructurados que permitan optimizar la ventaja competitiva de nuestro proyecto.

## 2. Puntos de Investigación Obligatorios

### A. Modelo de Precios y Límites (Pricing Analysis)
- **Meta:** Mapear cada plan de precios.
- **Datos a extraer:**
  - Costo mensual por plan.
  - Límite de tiendas conectadas por plan.
  - Límite de productos sincronizados por tienda.
  - Funcionalidades bloqueadas/habilitadas según el plan.
  - Existencia de cargos adicionales por volumen de pedidos.

### B. Flujo de Usuario y Onboarding (UX Reverse Engineering)
- **Meta:** Entender la fricción del usuario al iniciar.
- **Datos a extraer:**
  - Pasos exactos desde la instalación hasta la primera sincronización.
  - Requerimientos de permisos (scopes) solicitados a la API de Shopify.
  - Metodología de vinculación entre tiendas (¿Email? ¿Link de invitación? ¿Código?).

### C. Lógica de Sincronización (Technical Behavior)
- **Meta:** Determinar el comportamiento del motor de sync.
- **Datos a extraer:**
  - ¿Cómo manejan los conflictos de stock (ej. venta simultánea)?
  - ¿Qué campos son obligatorios para la sincronización?
  - ¿Cómo gestionan el mapeo de variantes de producto?

### D. Análisis de Sentimiento y Puntos de Dolor (Pain Points)
- **Meta:** Identificar debilidades del competidor.
- **Fuentes:** Shopify App Store Reviews, Trustpilot, Foros de Ecommerce.
- **Datos a extraer:**
  - Quejas recurrentes sobre el soporte técnico.
  - Fallos reportados en la sincronización de inventario.
  - Críticas sobre la interfaz de usuario (UI).

## 3. Metodología de Ejecución Recomendada
1. **Sondeo Inicial:** Analizar `syncio.app/pricing` y `syncio.app/help` utilizando herramientas de renderizado de JS (Puppeteer/Playwright).
2. **Análisis de Red:** Monitorear las peticiones de red (Network Tab) durante la navegación en la landing para encontrar endpoints de API públicos o archivos de configuración.
3. **Minería de Reseñas:** Scrapear la sección de reviews de la Shopify App Store filtrando por estrellas (1 y 2 estrellas) para extraer los *Pain Points*.

## 4. Formato de Entrega Esperado
El resultado debe ser entregado en un archivo Markdown en la ruta `/wiki/architecture/COMPETITION_ANALYSIS_SYNCIO.md` con la siguiente estructura:
- Resumen Ejecutivo.
- Tabla Comparativa de Precios.
- Mapa de Flujo de Onboarding.
- Lista de "Oportunidades de Mejora" para nuestro proyecto.
