# Especificación de Funcionalidad: Registro de Usuario

## 1. Descripción
Permitir que nuevos usuarios se unan a la plataforma de tres maneras distintas: mediante un formulario tradicional (Email/Password), a través de Google OAuth2, o a través de Facebook OAuth2. El objetivo es minimizar la fricción en el onboarding.

## 2. Datos Requeridos

### 2.1 Registro mediante Formulario (Email/Password)
- **Nombre de la Empresa (Opcional):** `companyName` (string).
- **Nombre Completo (Obligatorio):** `name` (string).
- **Correo Electrónico (Obligatorio):** `email` (string, único).
- **Contraseña (Obligatorio):** `password` (string, debe ser hasheada).

### 2.2 Registro mediante Proveedores Sociales (Google/Facebook)
- **Nombre Completo:** Obtenido del perfil del proveedor (`name`).
- **Correo Electrónico:** Obtenido del perfil del proveedor (`email`).
- **Nombre de la Empresa:** *Pendiente de definición*. Se sugiere que tras el login social inicial, si el usuario no tiene una empresa asignada, se le redirija a un paso de "Completar Perfil" para ingresar su `companyName`.
- **Contraseña:** No requerida (se maneja la autenticación con el proveedor).

## 3. Flujos de Trabajo

### 3.1 Flujo de Registro Tradicional
1. El usuario envía los datos al endpoint `POST /auth/register`.
2. El sistema valida que el email no esté registrado.
3. Se genera un `tenantId` (si es un usuario nuevo que crea su propia organización) o se asigna uno por defecto.
4. Se hashea la contraseña.
5. Se crea el registro en la base de datos.
6. Se devuelve un JWT de acceso.

### 3.2 Flujo de Registro Social
1. El usuario inicia el flujo de OAuth con el proveedor.
2. El proveedor redirige al backend con un token/perfil.
3. El backend busca al usuario por email:
   - **Si existe:** Se actualizan sus datos (nombre) y se inicia sesión.
   - **Si no existe:** Se crea un nuevo usuario con `password` vacío/nulo y se inicia sesión.
4. El sistema detecta si el usuario tiene `companyName` vacío y marca la cuenta para "onboarding pendiente".

## 4. Entidades y Base de Datos
Se debe actualizar la entidad `User` para incluir el campo `companyName`.

## 5. Endpoints de la API
- `POST /auth/register`: Registro tradicional.
- `GET /auth/google`: Inicio de flujo Google.
- `GET /auth/google/callback`: Callback Google.
- `GET /auth/facebook`: Inicio de flujo Facebook.
- `GET /auth/facebook/callback`: Callback Facebook.
