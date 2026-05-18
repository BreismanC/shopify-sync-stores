# Especificación de API: Configuración de Auth e Infraestructura

## Resumen
Configuración de la infraestructura base de autenticación y base de datos utilizando NestJS, TypeORM y PostgreSQL, siguiendo principios de Clean Architecture y SOLID.

## Arquitectura
- **Patrón:** Clean Architecture (Dominio, Aplicación, Infraestructura).
- **Multitenancy:** Discriminación por columna utilizando `tenantId` en todas las entidades dependientes del tenant.
- **Estrategia de Auth:** JWT (JSON Web Tokens) sin estado, compartido entre el Frontend (NextAuth.js v5) y el Backend (NestJS) mediante un `AUTH_SECRET` común.

## Componentes Principales

### 1. Base de Datos (Infraestructura)
- **ORM:** TypeORM.
- **DB:** PostgreSQL.
- **Módulo:** `DatabaseModule` gestiona la conexión asíncrona utilizando variables de entorno.

### 2. Entidades (Dominio)
- `Tenant`: Representa la unidad organizativa de nivel superior.
- `User`: Representa a los usuarios individuales, vinculados a un `Tenant` mediante `tenantId`.

### 3. Autenticación (Aplicación)
- **Flujo:** 
  1. El cliente envía credenciales a `POST /auth/login`.
  2. `AuthService` valida al usuario mediante `bcrypt`.
  3. `AuthService` genera un JWT que contiene `sub` (ID de usuario), `email` y `tenantId`.
- **Módulo:** `AuthModule` encapsula la lógica de JWT y el acceso al repositorio de usuarios de TypeORM.

#### 3.1 Autenticación Social (OAuth2)
Para permitir el inicio de sesión mediante proveedores externos (Google, Facebook), se seguirá el siguiente flujo:

1. **Inicio de sesión:** El cliente (Frontend) inicia la solicitud de autenticación con el proveedor.
2. **Redirección:** El proveedor redirige al usuario al endpoint de callback en el Backend.
3. **Validación de Perfil:** El Backend utiliza la estrategia de Passport correspondiente para validar el token del proveedor y obtener el perfil del usuario (email, nombre, etc.).
4. **Gestión de Usuario:** 
   - Se busca el usuario en la base de datos mediante su email.
   - Si el usuario existe, se actualiza su información si es necesario.
   - Si el usuario no existe, se crea un nuevo registro vinculado al `Tenant` correspondiente (o se le solicita al usuario completar el onboarding).
5. **Emisión de Token:** El `AuthService` genera un JWT estándar (con `sub`, `email`, `tenantId`) y lo devuelve al cliente.

Este flujo asegura que, independientemente del método de entrada, el sistema siempre trabaje con los JWT internos consistentes.
