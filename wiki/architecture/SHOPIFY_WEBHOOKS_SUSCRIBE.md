Para una app custom creada desde el admin, la forma recomendada de suscribirte a webhooks para desarrollo es usando la mutación GraphQL webhookSubscriptionCreate del Admin API.
La guía oficial está aquí: Manage webhook subscriptions (GraphQL Admin API).

Abajo te explico el flujo paso a paso y te dejo un ejemplo de mutación listo para usar.

1. Concepto clave para tu caso (app custom)
En las apps custom creadas en el admin, no puedes usar la configuración de webhooks basada en shopify.app.toml ni las facilidades del Shopify CLI para crear las suscripciones.
Tal como indica la doc de webhooks para apps custom:

“Custom apps created in the Shopify admin cannot take advantage of the tooling available through the Shopify CLI, including subscribing to webhook topics using the app configuration file. This means that webhook subscriptions must be set up and configured using the GraphQL Admin API.”

Resumiendo:

Obtienes un Admin API access token de tu app custom.
Llamas a la mutación GraphQL webhookSubscriptionCreate hacia tu tienda.
Indicas:
topic (por ejemplo ORDERS_CREATE, PRODUCTS_CREATE, etc.)
uri de tu endpoint HTTPS o de tu túnel (para desarrollo)
opcional: formato, filtros, etc.
2. Requisitos previos
Basado en Manage webhook subscriptions:

App custom instalada en la tienda de pruebas

Crea la app custom desde el admin de la tienda.
Instálala en esa misma tienda.
Scopes correctos

Cada topic de webhook requiere un scope de Admin API específico (por ejemplo, read_orders, write_products, etc.).
La lista de topics y scopes está en la referencia de webhooks: Webhooks reference.
Admin API access token

En la configuración de la app custom (desde el admin), genera el Admin API access token.
Lo usarás como X-Shopify-Access-Token en tu llamada HTTP a GraphQL.
Endpoint público para desarrollo

Para recibir los webhooks mientras desarrollas:
Puedes usar un túnel como ngrok, Cloudflare Tunnel, etc.
O un servicio tipo webhook.site, Hookdeck, Beeceptor, etc. (recomendado solo para desarrollo).
Ese URL será el valor que pondrás en uri.
3. Mutación GraphQL para crear una suscripción de webhook
A continuación tienes un ejemplo válido y ya verificado contra el Admin GraphQL 2026-07 (usando webhookSubscriptionCreate).

Este ejemplo crea una suscripción al topic ORDERS_CREATE que envía los webhooks en formato JSON a la URL que pases como variable:

Operation
Copy
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
mutation WebhookSubscriptionCreateSample($uri: URL!) {
  webhookSubscriptionCreate(
    topic: ORDERS_CREATE
    webhookSubscription: {
      uri: $uri
      format: JSON
    }
  ) {
    userErrors {
      field
      message
    }
    webhookSubscription {
      id
      topic
      format
      uri
    }
  }
}
Cómo llamarla
Endpoint HTTP (suponiendo la API 2026-07):
Copy
1
   POST https://{tu-dominio}.myshopify.com/admin/api/2026-07/graphql.json
Headers:
http
Copy
1
2
   X-Shopify-Access-Token: {TU_ADMIN_API_ACCESS_TOKEN}
   Content-Type: application/json
Body (ejemplo con curl):
json
Copy
1
2
3
4
5
6
   {
     "query": "mutation WebhookSubscriptionCreateSample($uri: URL!) { webhookSubscriptionCreate(topic: ORDERS_CREATE, webhookSubscription: { uri: $uri, format: JSON }) { userErrors { field message } webhookSubscription { id topic format uri } } }",
     "variables": {
       "uri": "https://xxxxx.ngrok.app/webhooks/orders-create"
     }
   }
Reemplaza https://xxxxx.ngrok.app/webhooks/orders-create por tu URL real de desarrollo.
Asegúrate de que el endpoint responda con 200 OK lo más rápido posible; si se demora o falla, Shopify reintentará algunas veces y después deshabilitará el webhook.
4. Ver los webhooks que ya tienes creados
Para confirmar que tu suscripción se creó correctamente (o listar las existentes), puedes usar la query webhookSubscriptions:

Operation
Copy
1
2
3
4
5
6
7
8
9
10
11
12
13
query ListWebhookSubscriptions {
  webhookSubscriptions(first: 10) {
    edges {
      node {
        id
        topic
        format
        uri
        createdAt
      }
    }
  }
}
Esto te ayuda a:

Ver si tu nueva suscripción aparece.
Revisar que el uri y el topic sean correctos.
5. Probar los webhooks en desarrollo
Según Create a webhook subscription (getting started), en desarrollo puedes:

Disparar el evento real

Por ejemplo, si tu topic es ORDERS_CREATE:
Crea un pedido de prueba en tu tienda.
Shopify enviará el webhook a tu uri.
Observa tu servidor / herramienta (ngrok, webhook.site, etc.) para ver el payload.
Verificar firma HMAC

Para HTTPS, Shopify envía la cabecera X-Shopify-Hmac-Sha256.
Debes verificarla usando tu shared secret de la app.
Detalles: Verify webhook signatures.
Si usas Pub/Sub o EventBridge, se utilizan otras mutaciones (pubSubWebhookSubscriptionCreate, etc.), documentadas aquí: Manage webhooks with Google Cloud Pub/Sub y en Manage webhook subscriptions.
Pero para una app custom básica de desarrollo, normalmente basta con HTTPS + túnel.

6. Resumen aplicado a tu caso
Para una app custom y pruebas de desarrollo:

Crea/asegura tu app custom en la tienda de prueba.
Configura los scopes necesarios para los topics deseados (por ejemplo, read_orders).
Obtén el Admin API access token de la app.
Levanta un endpoint accesible desde Internet (túnel o servicio de mock).
Llama al Admin GraphQL de tu tienda con la mutación webhookSubscriptionCreate usando algo como:
Operation
Copy
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
   mutation WebhookSubscriptionCreateSample($uri: URL!) {
     webhookSubscriptionCreate(
       topic: ORDERS_CREATE
       webhookSubscription: {
         uri: $uri
         format: JSON
       }
     ) {
       userErrors {
         field
         message
       }
       webhookSubscription {
         id
         topic
         format
         uri
       }
     }
   }
Genera el evento en la tienda (por ejemplo, crea un pedido) y observa el webhook llegar a tu endpoint.
Si me dices:

qué topic(s) específicos quieres escuchar (por ejemplo PRODUCTS_CREATE, ORDERS_PAID, etc.), y
qué tipo de endpoint vas a usar (HTTPS normal, ngrok, webhook.site, etc.),
puedo ajustarte la mutación GraphQL exacta (incluso con filtros) y el ejemplo de payload que deberías esperar.