# 🎯 Alcance y Limitaciones - shopify-sync-stored

## 1. Definición del Proyecto
El proyecto consiste en el desarrollo de una plataforma **SaaS (Software as a Service)** multitenant diseñada para centralizar la gestión y sincronización de tiendas virtuales basadas en Shopify. El sistema actúa como un puente entre tiendas **Proveedoras** y tiendas **Vendedoras/Suscriptoras**, automatizando el flujo de productos, inventarios y pedidos.

## 2. Alcance Funcional y Definiciones de Negocio

El sistema se rige por los siguientes pilares operativos, diseñados para garantizar la eficiencia y la escalabilidad del modelo SaaS:

### 2.1 Modelo de Interconectividad de Tiendas
- **Objetivo:** Establecer el protocolo de confianza y vinculación entre actores.
- **Definición:** Sistema de "Invitación y Aceptación". El Proveedor es la entidad ancla que inicia la relación.
- **Alcance:** Gestión de solicitudes de conexión, validación de tiendas receptoras y control de estados del vínculo (Pendiente $\rightarrow$ Activo $\rightarrow$ Revocado).

### 2.2 Política de Sincronización de Atributos
- **Objetivo:** Controlar la fidelidad de la información replicada.
- **Definición:** Implementación de "Reglas de Visibilidad y Modificación".
- **Alcance:** Definición de atributos sincronizables (Precio, Stock, Títulos, Imágenes) y lógica de "Soberanía de Datos" (decidir si la tienda destino puede modificar un precio sincronizado o si este es bloqueado por el proveedor).

### 2.3 Lógica de Sincronización de Inventario Crítico
- **Objetivo:** Eliminar el riesgo de sobreventa (*overselling*).
- **Definición:** Sincronización basada en la "Verdad Única" del inventario del proveedor.
- **Alcance:** Actualización inmediata de stock en todas las tiendas conectadas ante cualquier venta, con soporte para reserva temporal de stock durante el checkout.

### 2.4 Sistema de Distribución de Ingresos (Revenue Splits)
- **Objetivo:** Automatizar la rentabilidad y liquidación de comisiones.
- **Definición:** Modelo de "Comisión por Transacción" transparente y auditable.
- **Alcance:** Cálculo de comisiones netas (descontando impuestos/envíos), definición de reglas por producto y gestión de ciclos de liquidación (diario, semanal, mensual).

### 2.5 Estrategia de Onboarding y Activación
- **Objetivo:** Reducir el *Time-to-Value* del usuario.
- **Definición:** Flujo guiado de configuración rápida (*Quick-Start*) mediante **Custom Apps**.
- **Alcance:** Mapeo del camino crítico: Instalación $\rightarrow$ Conexión de tienda $\rightarrow$ Primera sincronización exitosa, minimizando la fricción de permisos de API.

### 2.6 Modelo de Monetización SaaS
- **Objetivo:** Alinear el costo del servicio con el valor generado.
- **Definición:** Planes basados en volumen de sincronización.
- **Alcance:** Niveles de planes (Starter, Pro, Enterprise) con límites cuantitativos de tiendas conectadas, productos sincronizados y acceso a funcionalidades premium.

## 3. Limitaciones y Exclusiones

### 3.1 Exclusiones Técnicas
- **Plataformas Externas:** No se integrarán plataformas distintas a Shopify en la fase inicial.
- **Soporte Técnico:** El módulo de tickets y chat de soporte ha sido excluido del alcance actual.
- **Inteligencia Artificial:** No se implementarán módulos de analítica predictiva o IA en la fase MVP.
- **Internacionalización:** El sistema será inicialmente unilingüe (Español).

### 3.2 Limitaciones Operativas (Límites de Performance)
- **Carga:** Optimizado para un máximo de 100 tiendas conectadas inicialmente.
- **Volumen:** Límite de 100 productos sincronizados por cada tienda.
- **Latencia:** El tiempo objetivo de sincronización es de 10 segundos por operación.

## 4. Criterios de Éxito
- Sincronización exitosa de un producto vía SKU desde una tienda proveedora a una suscriptora.
- Actualización de stock en tiempo real sin errores de sobreventa.
- Registro y cálculo correcto de comisiones sobre un pedido sincronizado.
