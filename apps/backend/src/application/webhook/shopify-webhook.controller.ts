import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ProcessShopifyWebhookUseCase } from './process-shopify-webhook.use-case';

@Controller('webhooks/shopify')
export class ShopifyWebhookController {
  constructor(private readonly processWebhook: ProcessShopifyWebhookUseCase) {}

  @Post()
  @HttpCode(200)
  receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') hmac: string,
    @Headers('x-shopify-topic') topic: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Headers('x-shopify-event-id') eventId: string,
    @Headers('x-shopify-triggered-at') triggeredAt?: string,
  ) {
    return this.processWebhook.execute({
      rawBody: request.rawBody ?? Buffer.from(JSON.stringify(request.body)),
      hmac,
      topic,
      shopDomain,
      eventId,
      triggeredAt,
    });
  }
}
