# MercadoPago Webhooks en Desarrollo: Cloudflared Tunnel

## Contexto

MercadoPago (y la mayoría de los proveedores de pagos) necesita una **URL pública HTTPS** para enviar notificaciones IPN a nuestro backend. En desarrollo local (`http://localhost:3001`) las notificaciones nunca llegan porque MP no puede alcanzar `localhost`.

**Cloudflared Tunnel** (`cloudflared`) es la opción recomendada porque:
- Es gratuita, no requiere cuenta en Cloudflare.
- Genera un dominio público tipo `https://<random>.trycloudflare.com` en cada ejecución.
- Soporta HTTPS sin certificados locales.
- Es de un solo comando, sin configuración.

Alternativas: `ngrok` (de pago para uso prolongado), `localtunnel` (menos estable). No las recomendamos.

---

## Setup (una sola vez)

### Instalar `cloudflared`

**macOS (Homebrew):**
```bash
brew install cloudflared
```

**Linux (Debian/Ubuntu):**
```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared focal main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

**Windows (winget):**
```powershell
winget install --id Cloudflare.cloudflared
```

Verificar:
```bash
cloudflared --version
```

---

## Uso durante el desarrollo

### 1. Levantar el backend

```bash
pnpm --filter backend dev
# Backend corriendo en http://localhost:3001
```

### 2. Levantar el tunnel

En otra terminal:

```bash
cloudflared tunnel --url http://localhost:3001
```

Salida esperada:
```
Your quick Tunnel has been created! Visit it at:
https://<random-uuid>.trycloudflare.com
+-----------------------------------------------------------+
|  El subdominio cambia en cada ejecución                   |
|  No es fijo, hay que actualizar el dashboard de MP cada   |
|  vez que reiniciás cloudflared                            |
+-----------------------------------------------------------+
```

### 3. Configurar la URL del webhook en MercadoPago

1. Ir a [MercadoPago Dashboard → Webhooks](https://www.mercadopago.com.co/developers/panel/webhooks).
2. Crear (o editar) un webhook con la URL:
   ```
   https://<random-uuid>.trycloudflare.com/api/webhooks/mercadopago
   ```
3. Topics a suscribir: `preapproval`, `payment`.
4. (Opcional) Copiar el secret generado y setear `MERCADOPAGO_WEBHOOK_SECRET` en `apps/backend/.env`.

### 4. Probar el flujo de pago

1. Hacer un pago de prueba (sandbox) desde la app.
2. Verificar en la consola del backend que llega el webhook:
   ```
   [MercadoPagoWebhook] Preapproval event: <id> - active
   ```
3. Si `MERCADOPAGO_WEBHOOK_SECRET` está configurado, el backend validará la firma antes de procesar.

---

## Script de conveniencia

Agregar a `package.json` raíz del monorepo (sección `scripts`):

```json
{
  "scripts": {
    "tunnel:dev": "cloudflared tunnel --url http://localhost:3001"
  }
}
```

Uso:
```bash
pnpm tunnel:dev
```

---

## Troubleshooting

### El tunnel muestra "connection refused"
- Verificar que el backend esté corriendo en el puerto correcto.
- Si usás un puerto distinto, ajustar el comando: `cloudflared tunnel --url http://localhost:<puerto>`.

### La URL cambió y no me di cuenta
- Cada ejecución de `cloudflared` genera una URL nueva.
- La URL queda visible en la consola. Si la perdés, simplemente reiniciá el tunnel y actualizá el dashboard de MP.
- Para tener una URL fija, crear un [named tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (requiere dominio en Cloudflare).

### MercadoPago no envía webhooks
- Verificar que la URL termine en `/api/webhooks/mercadopago` (ruta del controller).
- En el dashboard de MP, sección "Webhooks", ver el historial de intentos.
- Revisar logs del backend: `console.log('[MercadoPagoWebhook] ...')`.

### Error de firma
- Si `MERCADOPAGO_WEBHOOK_SECRET` está configurado en `.env` pero no coincide con el del dashboard, el controller rechaza el webhook.
- En dev se puede dejar sin secret (omite la verificación con warning).

---

## Producción

En producción (Vercel/Railway/Fly, etc.) el webhook usa la URL pública del backend, por ejemplo:
```
https://api.siempre-sucio.com/api/webhooks/mercadopago
```

No se necesita cloudflared. La firma del webhook DEBE estar habilitada en producción con `MERCADOPAGO_WEBHOOK_SECRET`.
