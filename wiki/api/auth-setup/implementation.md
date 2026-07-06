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
- `User`: Representa a los usuarios individuales, vinculados a un `Tenant` mediante `tenantId` (nullable).

### 3. Autenticación (Aplicación)

- **Flujo:** 
  1. El cliente envía credenciales a `POST /auth/login`.
  2. `AuthService` valida al usuario mediante `bcrypt`.
  3. `AuthService` genera un JWT que contiene `sub` (ID de usuario), `email` y `tenantId` (puede ser null).
- **Módulo:** `AuthModule` encapsula la lógica de JWT y el acceso al repositorio de usuarios de TypeORM.

#### 3.1 Autenticación Social (OAuth2)

Para permitir el inicio de sesión mediante proveedores externos (Google, Facebook), se sigue el siguiente flujo:

1. **Inicio de sesión:** El cliente (Frontend) inicia la solicitud de autenticación con el proveedor.
2. **Redirección:** El proveedor redirige al usuario al endpoint de callback en el Backend.
3. **Validación de Perfil:** El Backend utiliza la estrategia de Passport correspondiente para validar el token del proveedor y obtener el perfil del usuario (email, nombre, etc.).
4. **Gestión de Usuario:** 
   - Se busca el usuario en la base de datos mediante su email.
   - Si el usuario existe, se retorna el usuario existente.
   - Si el usuario no existe, se crea un nuevo registro con `tenantId: null` (el tenant se crea en el onboarding mediante upsert).
5. **Emisión de Token:** El `AuthService` genera un JWT estándar (con `sub`, `email`, `tenantId: null`) y lo devuelve al cliente.

**Diferencia clave:** El registro social NO crea un Tenant automáticamente. El usuario social debe completar el onboarding para crear su Tenant.

#### 3.2 Endpoints de Auth

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/login` | Login por credenciales email/password |
| POST | `/auth/register` | Registro tradicional (crea Tenant + User) |
| GET | `/auth/google` | Inicia flujo Google OAuth |
| GET | `/auth/google/callback` | Callback de Google OAuth |
| GET | `/auth/facebook` | Inicia flujo Facebook OAuth |
| GET | `/auth/facebook/callback` | Callback de Facebook OAuth |
| GET | `/auth/my-tenants` | Lista todos los tenants del usuario |
| POST | `/auth/tenant` | Upsert de tenant (crea o actualiza) |
| GET | `/auth/tenant` | Obtiene el tenant actual del usuario |
| POST | `/auth/tenant/select` | Selecciona un tenant como activo |

## 4. Modelo de Datos - Usuario con Tenant Nullable

```typescript
// User Entity
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { nullable: true })
  tenant: Tenant | null;

  @Column({ nullable: true })
  tenantId: string | null;  // Ahora es nullable

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;  // Nullable para usuarios sociales

  @Column()
  name: string;

  @Column({ nullable: true })
  companyName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.MEMBER })
  role: UserRole;

  @Column({ type: 'enum', enum: OnboardingStatus, default: OnboardingStatus.PENDING_STORE_CONFIG })
  onboardingStatus: OnboardingStatus;
}
```

## 5. Lógica de Redirección

El frontend determina la redirección basándose en el `tenantId` del usuario contenido en el JWT:

| Condición | Redirección |
|-----------|-------------|
| Login exitoso Y `tenantId` existe | `/dashboard` |
| Login exitoso Y `tenantId` es null | `/onboarding` |
| En onboarding, tenant ya existe | Mostrar nombre (pre-poblado) |
| En onboarding, tenant no existe | Solicitar nombre de empresa |
| Usuario con múltiples tenants | `/tenant-selector` |