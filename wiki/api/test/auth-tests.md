# Estrategia de Pruebas: Autenticación

## Objetivo
Garantizar la integridad y seguridad de los procesos de autenticación y registro, cubriendo tanto el flujo tradicional de email/password como los flujos de proveedores sociales (OAuth2).

## Alcance de las Pruebas Unitarias
Las pruebas se centran en la capa de aplicación (`AuthService`), utilizando mocks para las dependencias de infraestructura (`IUserRepository`) y servicios externos (`JwtService`, `bcrypt`).

## Casos de Prueba Implementados

### 1. Validación de Credenciales (`validateUser`)
| Caso de Prueba | Entrada | Resultado Esperado |
| :--- | :--- | :--- |
| Usuario válido | Email y password correctos | Devuelve el objeto `User` sin la contraseña |
| Email inexistente | Email no registrado | Devuelve `null` |
| Contraseña incorrecta | Email válido, password erróneo | Devuelve `null` |

### 2. Registro de Usuario (`register`)
| Caso de Prueba | Entrada | Resultado Esperado |
| :--- | :--- | :--- |
| Registro exitoso | Datos válidos (incluyendo `companyName` opcional) | Crea usuario, hashea contraseña y devuelve JWT |
| Email duplicado | Email ya existente en la DB | Lanza `UnauthorizedException` |

### 3. Autenticación Social (`validateOrCreateSocialUser`)
| Caso de Prueba | Entrada (Perfil Social) | Resultado Esperado |
| :--- | :--- | :--- |
| Nuevo usuario social | Email no registrado | Crea nuevo usuario vinculado al `tenantId` |
| Usuario social existente | Email ya registrado | Actualiza el nombre del usuario y devuelve el existente |

### 4. Emisión de Token (`login`)
| Caso de Prueba | Entrada | Resultado Esperado |
| :--- | :--- | :--- |
| Login exitoso | Objeto `User` válido | Devuelve `access_token` y datos del usuario |

## Herramientas Utilizadas
- **Framework:** Jest
- **Librerías:** `@nestjs/testing`, `bcrypt` (mocked), `@nestjs/jwt` (mocked)
