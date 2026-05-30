# Especificación de Funcionalidad: Autenticación e Infraestructura Core

## 1. Visión General
El objetivo de esta funcionalidad es establecer la infraestructura base de autenticación y base de datos para el proyecto SaaS de Sincronización de Shopify. Esto implica configurar un backend robusto con NestJS y TypeORM, y una experiencia de autenticación fluida usando NextAuth.js (v5) que funcione en frontend y backend.

## 2. Requerimientos del Backend (NestJS)

### 2.1 Configuración de Base de Datos
- **Tecnología:** PostgreSQL.
- **ORM:** TypeORM.
- **Tarea:**
    - Configurar TypeORM para conectarse a una instancia de PostgreSQL.
    - Establecer la configuración inicial de conexión a la base de datos (variables de entorno para host, puerto, usuario, contraseña, nombre de base de datos).
    - Asegurar que el backend pueda realizar operaciones CRUD básicas vía TypeORM una vez definidas las entidades.

### 2.2 Integración de Autenticación
- **Tecnología:** NextAuth.js (v5).
- **Tarea:**
    - Implementar un mecanismo para validar/compartir el estado de autenticación entre backend y frontend.
    - (Nota: Esto puede involucrar validación de JWT o una estrategia de sesión compartida que el backend de NestJS pueda verificar).

## 3. Requerimientos del Frontend (Next.js)

### 3.1 Integración de Autenticación
- **Tecnología:** NextAuth.js (v5).
- **Tarea:**
    - Instalar y configurar NextAuth.js (v5) en la aplicación Next.js.
    - Configurar providers (ej. Credentials provider u OAuth si está planificado).

### 3.2 Enrutamiento y Control de Acceso
- **Rutas Públicas:** Crear al menos una página de inicio pública (ej. `/`).
- **Rutas Protegidas:**
    - Implementar middleware o protección basada en layout para cualquier ruta que empiece con `/dashboard/*`.
    - Asegurar que usuarios no autenticados sean redirigidos a la página de login al intentar acceder a `/dashboard/*`.
    - Asegurar que usuarios autenticados puedan acceder al dashboard.

## 4. Detalles Técnicos y Restricciones
- **Estructura Monorepo:** Usar el workspace existente de Turborepo/pnpm.
- **Configuración Compartida:** Las variables de entorno para base de datos y secrets de autenticación deben gestionarse cuidadosamente (usando archivos `.env` en las apps respectivas o una configuración compartida del workspace).
- **Flujo de Autenticación:** La autenticación debe estar "conectada" para que el backend pueda confiar en las sesiones/tokens generados por NextAuth en el frontend.

## 5. Criterio de Terminación (DoD)
- [ ] El backend se conecta exitosamente a PostgreSQL usando TypeORM.
- [ ] El backend puede verificar una sesión/token de autenticación.
- [ ] El frontend está configurado con NextAuth.js v5.
- [ ] Un usuario puede iniciar sesión y acceder a una página bajo `/dashboard/`.
- [ ] Un usuario no autenticado es bloqueado de `/dashboard/` y redirigido.
- [ ] Todas las nuevas dependencias están correctamente agregadas a `package.json` en sus respective apps.