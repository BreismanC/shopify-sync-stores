# Especificación: Recuperación de Contraseña

## 1. Descripción
Funcionalidad que permite a los usuarios recuperar el acceso a su cuenta en caso de haber olvidado la contraseña.

## 2. Flujo de Usuario
1. **Inicio**: En el login, enlace "¿Olvidaste tu contraseña?".
2. **Solicitud**: Página de ingreso de email. Validación AJV de formato.
3. **Envío**: Sistema envía email vía Resend. Implementar rate-limiting (5 min de espera para reenviar).
4. **Validación Email**: Token JWT generado con 1 hora de expiración.
5. **Reset**: Página de nueva contraseña. Validar que coincidan.
6. **Finalización**: Actualización en BD (cifrado bcrypt).

## 3. Requerimientos Técnicos
- **Email**: Resend + React Email.
- **Token**: JWT (1h expiración).
- **Seguridad**: Cifrado bcrypt (estándar del registro).
- **Frontend**: Formulario usando `Form.tsx`, `use-dynamic-form`, validación AJV.
- **Backend**: Endpoint de solicitud y endpoint de reset.

## 4. Definition of Done (DoD)
- [ ] Endpoints implementados (RequestReset, ResetPassword).
- [ ] Frontend implementado (Página solicitud, Página nueva contraseña).
- [ ] Email enviado correctamente con plantilla React Email.
- [ ] Validación de coincidencia de contraseñas.
- [ ] Rate-limit de 5 minutos implementado en envío de correos.
- [ ] Pruebas unitarias/integración de los casos de éxito y error.
- [ ] Documentación de API en Bruno actualizada.
