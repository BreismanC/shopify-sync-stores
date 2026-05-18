# ✅ Definition of Done (DoD) - Estándar de Calidad

Para que una funcionalidad o módulo sea marcado como **"Terminado" (Done)**, debe cumplir estrictamente con los siguientes criterios:

## 1. Desarrollo Técnico
- [ ] **Código Implementado:** La funcionalidad está escrita en TypeScript siguiendo los principios de Clean Architecture.
- [ ] **Revisión de Peer:** El código ha sido revisado y no contiene errores lógicos evidentes.
- [ ] **Cero Errores:** No existen errores de compilación ni advertencias críticas de ESLint.

## 2. Pruebas y Validación
- [ ] **Pruebas Unitarias:** Se han implementado pruebas para la lógica de negocio core.
- [ ] **Pruebas de API:** El endpoint ha sido probado con herramientas como Postman o Insomnia y devuelve la respuesta esperada.
- [ ] **Criterios de Aceptación:** Se ha validado que la funcionalidad cumple con el RF correspondiente en la Matriz de Trazabilidad.

## 3. Documentación y Contexto
- [ ] **Wiki Actualizada:** Si hubo cambios en el flujo o en los datos, el documento correspondiente en `/wiki` ha sido actualizado.
- [ ] **Documentación de API:** El endpoint está documentado (ej. via Swagger/OpenAPI).

## 4. Despliegue y Verificación
- [ ] **Entorno de Desarrollo:** La funcionalidad es operable en el entorno local y no rompe otras partes del sistema.
- [ ] **Carga de Datos:** Se ha probado la funcionalidad con datos reales o simulados de Shopify.
