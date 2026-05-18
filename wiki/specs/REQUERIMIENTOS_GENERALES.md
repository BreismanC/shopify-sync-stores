# 📋 Requerimientos Generales - shopify-sync-stored

## 1. Visión General
Plataforma **SaaS (Software as a Service)** multitenant diseñada para centralizar la gestión y sincronización de tiendas virtuales basadas en Shopify. El sistema actúa como un puente entre tiendas **Proveedoras** y tiendas **Vendedoras/Suscriptoras**, automatizando el flujo de productos, inventarios y pedidos.

## 2. Objetivos Estratégicos
- **Sincronización Automatizada:** Eliminar la carga manual de productos y errores de stock.
- **Marketplace de Conexiones:** Facilitar la búsqueda y vinculación de proveedores y vendedores.
- **Trazabilidad Total:** Monitorear en tiempo real el estado de cada sincronización y pedido.
- **Gestión Financiera:** Automatizar el cálculo de comisiones y pagos entre tiendas.

## 3. Requerimientos Funcionales (RF)

### 3.1 Onboarding y Configuración
- **RF-01:** Permitir la instalación de la aplicación mediante la creación de una **App Personalizada (Custom App)** en el panel de control de Shopify.
- **RF-02:** Permitir el registro en la plataforma mediante correo electrónico o autenticación OAuth.
- **RF-03:** Solicitar la selección del tipo de tienda (proveedora o vendedora) al momento de registrarse.
- **RF-04:** Permitir la selección de un plan de suscripción.
- **RF-05:** Ofrecer la opción de conectar una tienda fuente durante el onboarding.
- **RF-06:** Permitir la configuración del equipo de trabajo (usuarios, roles) al momento de registrarse.

### 3.2 Gestión de Tiendas y Conexiones
- **RF-07:** Permitir que una tienda pueda enviar una solicitud de conexión a otra tienda mediante correo.
- **RF-08:** Permitir a la tienda receptora aceptar o rechazar la solicitud.
- **RF-09:** Permitir la conexión a múltiples tiendas de forma simultánea.
- **RF-10:** Visualizar y gestionar todas las conexiones activas desde un panel de administración.
- **RF-11:** Cancelar una conexión existente con otra tienda.

### 3.3 Gestión de Productos
- **RF-12:** Permitir la importación de productos desde una tienda maestra a una tienda suscriptora.
- **RF-13:** Mantener sincronizados atributos clave: nombre, precio, descripción, imágenes, stock y variantes.
- **RF-14:** Permitir configurar reglas de sincronización por atributo (incluir/excluir).
- **RF-15:** Permitir al usuario modificar ciertos atributos de productos sincronizados si se encuentra habilitado.
- **RF-16:** Mostrar histórico de sincronización y cambios de cada producto.

### 3.4 Sincronización de Inventario
- **RF-17:** Sincronizar automáticamente el stock de productos entre tiendas conectadas.
- **RF-18:** Evitar errores de sobreventa al mantener información en tiempo real.
- **RF-19:** Permitir la activación o desactivación de la sincronización automática de stock.

### 3.5 Gestor de Sincronización
- **RF-20:** Configurar reglas personalizadas de sincronización (por frecuencia, evento o atributo).
- **RF-21:** Permitir la sincronización manual cuando la automática está desactivada.
- **RF-22:** Definir qué atributos se sincronizan y con qué prioridad.

### 3.6 Gestión de Pedidos
- **RF-23:** Sincronizar pedidos entre tienda vendedora y tienda proveedora en tiempo real.
- **RF-24:** Permitir definir reglas de comisiones por pedido sincronizado.
- **RF-25:** Permitir el seguimiento de los estados del pedido sincronizado desde ambas tiendas.
- **RF-26:** Registrar y mostrar las órdenes procesadas, en espera o fallidas.

### 3.7 Gestión de Pagos
- **RF-27:** Sincronizar pagos asociados a los pedidos en tiempo real.
- **RF-28:** Calcular automáticamente los pagos y comisiones entre tiendas.
- **RF-29:** Visualizar historial de pagos y sus estados.

### 3.8 Administración y Reportes
- **RF-30:** Mostrar el estado actual de cada módulo de sincronización (productos, pedidos, pagos).
- **RF-31:** Permitir el filtrado de información por tienda, fecha y tipo de sincronización.
- **RF-32:** Visualizar logs técnicos de sincronización y errores.
- **RF-33:** Mostrar métricas clave de desempeño en el dashboard principal.

### 3.9 Administración de Suscripciones
- **RF-34:** Permitir la selección y cambio de planes de suscripción.
- **RF-35:** Controlar el acceso a funcionalidades según el plan activo.
- **RF-36:** Integrar pasarela de pagos para cobro de suscripciones recurrentes.

### 3.10 Marketplace de Conexiones
- **RF-37:** Permitir explorar otras tiendas disponibles para conectar dentro de un marketplace interno.
- **RF-38:** Filtrar tiendas por categoría, país, productos ofrecidos, reputación, etc.
- **RF-39:** Enviar solicitud de conexión desde el marketplace.
- **RF-40:** Visualizar perfil de tienda con información clave.

### 3.11 Seguridad y Auditoría
- **RF-41:** Validar permisos de acceso según roles configurados.
- **RF-42:** Registrar acciones críticas por parte de los usuarios (ej. aprobar conexión, eliminar producto).
- **RF-43:** Visualizar logs de actividad por usuario y por módulo.
- **RF-44:** Mostrar errores técnicos registrados para depuración o soporte.

## 4. Requerimientos No Funcionales (RNF)

### 4.1 Infraestructura y Despliegue
- **RNF-01.** La aplicación debe ser desplegada en un servicio serverless que permita configuración rápida para entornos JavaScript/TypeScript (por ejemplo: Vercel, AWS Lambda con Serverless Framework).
- **RNF-02.** El sistema debe estar empaquetado utilizando contenedores Docker para garantizar portabilidad y facilitar el desarrollo y despliegue.
- **RNF-03.** La arquitectura inicial será monolítica (frontend y backend separados) con capacidad de escalar a microservicios en caso de ser necesario.
- **RNF-04.** El sistema debe permitir configurar pipelines de integración y despliegue continuo (CI/CD) utilizando GitHub Actions.

### 4.2 Tecnologías y Frameworks
- **RNF-05.** El frontend se desarrollará con Next.js + React y el backend con NestJS, ambos escritos en TypeScript.
- **RNF-06.** La base de datos principal será **PostgreSQL**, alojada en un servicio gestionado.
- **RNF-07.** Se permitirá la integración con un CMS headless como Strapi o Prismic para contenido estático o de soporte.
- **RNF-08.** Se utilizarán WebSockets para sincronización en tiempo real, complementado con Redis y BullMQ para procesamiento en segundo plano y colas de tareas.

### 4.3 Escalabilidad y Carga
- **RNF-09.** El sistema debe soportar al menos 100 tiendas conectadas, con un máximo de 100 productos sincronizados por tienda.
- **RNF-10.** El sistema debe diseñarse para escalar horizontalmente y soportar carga incremental sin comprometer la experiencia del usuario.
- **RNF-11.** La latencia debe estar optimizada para usuarios en Colombia, con opción de extender a otros países de Latinoamérica.

### 4.4 Seguridad
- **RNF-12.** Toda la comunicación entre cliente y servidor debe estar cifrada mediante HTTPS/TLS.
- **RNF-13.** La información sensible almacenada en base de datos debe estar cifrada en reposo usando estándares como AES-256.
- **RNF-14.** Se deben aplicar políticas de acceso basadas en roles y privilegios mínimos para usuarios autenticados.
- **RNF-15.** Aunque no se implementará inicialmente, el sistema debe permitir agregar autenticación multifactor (2FA) en el futuro.
- **RNF-16.** Se recomienda cumplir con principios de Privacy by Design y Data Minimization del GDPR, aunque no se requiere cumplimiento completo en fase inicial.
- **RNF-17.** Para pagos en línea, se debe usar una pasarela con cumplimiento PCI-DSS como MercadoPago.

### 4.5 Performance
- **RNF-18.** Las actualizaciones de sincronización en tiempo real deben reflejarse en un máximo de 10 segundos por operación.
- **RNF-19.** El sistema debe garantizar un nivel de disponibilidad mínimo del 90% SLA mensual.

### 4.6 Mantenibilidad y Operación
- **RNF-20.** El backend debe seguir principios de Clean Architecture y programación orientada a objetos.
- **RNF-21.** El sistema debe contar con pruebas automatizadas al menos a nivel de unidad y API (unit e2e).
- **RNF-22.** Se debe implementar un sistema de monitoreo y logs centralizados (por ejemplo, LogRocket, Sentry, Logtail o Grafana Loki).
- **RNF-23.** Se deben registrar errores críticos automáticamente y enviar alertas al equipo de desarrollo o soporte técnico.

### 4.7 Multitenencia y Multilenguaje
- **RNF-24.** El sistema debe ser multitenant, permitiendo la gestión de múltiples tiendas en una sola instancia con datos aislados por organización.
- **RNF-25.** El sistema no será multilenguaje en el lanzamiento inicial, pero debe estructurarse para facilitar su internacionalización (i18n) futura.

### 4.8 Integraciones
- **RNF-26.** Se integrará con la pasarela MercadoPago, compatible con múltiples países de Latinoamérica.
- **RNF-27.** El sistema debe permitir enviar notificaciones por correo electrónico, usando un proveedor como SendGrid, Mailgun o Resend.
- **RNF-28.** Las notificaciones deben ser configurables para eventos clave como errores de sincronización, cambios de estado en órdenes o productos.

### 4.9 Auditoría y Trazabilidad
- **RNF-29.** El sistema debe registrar todos los cambios importantes en productos, pedidos y conexiones entre tiendas con información del usuario y timestamp.
- **RNF-30.** Los logs y auditorías se deben mantener por un máximo de 3 meses, con opción de descarga/exportación por parte del administrador.
- **RNF-31.** Se debe contar con un Centro de Actividades visible por el usuario, donde pueda consultar el estado de sincronización de los módulos clave.
