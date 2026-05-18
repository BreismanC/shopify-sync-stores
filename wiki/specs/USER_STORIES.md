# 👤 Historias de Usuario - shopify-sync-stored

Este documento traduce los requerimientos funcionales (RF) en historias de usuario detalladas para guiar el desarrollo ágil.

## 1. Módulo de Onboarding y Acceso
| ID | Historia de Usuario | Criterios de Aceptación |
| :--- | :--- | :--- |
| **HU-01** | Como **nuevo usuario**, quiero instalar la app vía Custom App en Shopify para empezar a usar el sistema rápidamente. | - El usuario puede ingresar el API Key y Secret de su Custom App.<br>- El sistema valida la conexión con Shopify. |
| **HU-02** | Como **usuario**, quiero registrarme vía OAuth o Email para tener una cuenta segura y personalizada. | - Registro exitoso con validación de email.<br>- Login funcional mediante OAuth de Shopify. |
| **HU-03** | Como **usuario**, quiero definir si mi tienda es Proveedora o Vendedora para habilitar las funciones correctas. | - Selección obligatoria de rol al registrarse.<br>- La interfaz se adapta según el rol elegido. |
| **HU-04** | Como **usuario**, quiero elegir un plan de suscripción para acceder a las funcionalidades que necesito. | - Visualización de planes (Starter, Pro, Enterprise).<br>- Activación inmediata de límites según el plan. |

## 2. Gestión de Conexiones (Network)
| ID | Historia de Usuario | Criterios de Aceptación |
| :--- | :--- | :--- |
| **HU-05** | Como **Proveedor**, quiero invitar a una tienda vendedora vía email para iniciar la sincronización. | - Envío de invitación con link único.<br>- Registro de la solicitud en estado "Pendiente". |
| **HU-06** | Como **Vendedor**, quiero aceptar o rechazar una invitación de conexión para controlar quién accede a mis productos. | - Opción de aceptar/rechazar la invitación.<br>- Actualización del estado del vínculo a "Activo" o "Revocado". |
| **HU-07** | Como **Usuario**, quiero gestionar mis conexiones activas desde un panel para mantener mi red actualizada. | - Lista de tiendas conectadas.<br>- Opción de cancelar la conexión en un click. |

## 3. Núcleo de Sincronización (Core Sync)
| ID | Historia de Usuario | Criterios de Aceptación |
| :--- | :--- | :--- |
| **HU-08** | Como **Vendedor**, quiero importar productos de un proveedor para no tener que crearlos manualmente. | - Selección de productos específicos para importar.<br>- Creación automática de productos en la tienda destino. |
| **HU-09** | Como **Proveedor**, quiero definir qué atributos se sincronizan para proteger mi información sensible. | - Checklist de atributos (Precio, Stock, Desc, etc.).<br>- Cambios reflejados en tiempo real en las tiendas destino. |
| **HU-10** | Como **Usuario**, quiero que el stock se sincronice en tiempo real para evitar ventas de productos agotados. | - Actualización automática del stock en todas las tiendas vinculadas al ocurrir una venta. |
| **HU-11** | Como **Vendedor**, quiero modificar el precio de un producto sincronizado si mi proveedor lo permite. | - Verificación de permiso de modificación.<br>- El precio local prevalece sobre el del proveedor si está habilitado. |

## 4. Operaciones y Finanzas
| ID | Historia de Usuario | Criterios de Aceptación |
| :--- | :--- | :--- |
| **HU-12** | Como **Proveedor**, quiero que los pedidos de las tiendas destino se sincronicen en mi panel para gestionarlos. | - Recepción de órdenes en tiempo real.<br>- Registro de la tienda origen del pedido. |
| **HU-13** | Como **Proveedor**, quiero definir una comisión por cada venta realizada por mis vendedores. | - Configuración de porcentaje o monto fijo de comisión.<br>- Cálculo automático del monto a cobrar por pedido. |
| **HU-14** | Como **Administrador**, quiero visualizar la trazabilidad de sincronizaciones para resolver errores rápidamente. | - Log detallado de cada evento de sync.<br>- Filtros por fecha, tienda y estado (Éxito/Error). |

## 5. Marketplace y Soporte
| ID | Historia de Usuario | Criterios de Aceptación |
| :--- | :--- | :--- |
| **HU-15** | Como **Vendedor**, quiero buscar proveedores en un marketplace interno para expandir mi catálogo. | - Buscador con filtros por categoría y reputación.<br>- Perfil público de la tienda proveedora. |
| **HU-16** | Como **Usuario**, quiero gestionar mis suscripciones y cambiar de plan según el crecimiento de mi negocio. | - Interfaz de cambio de plan.<brC- Integración con pasarela de pagos para cobro recurrente. |
