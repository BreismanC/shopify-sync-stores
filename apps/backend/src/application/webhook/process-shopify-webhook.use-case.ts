import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQueuePublisher } from '../ports/queue-publisher.port';
import { IStoreRepository } from '../store/repositories/IStoreRepository';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { IWebhookDeliveryRepository } from './repositories/webhook-delivery.repository';
import { inventoryItemIdFromWebhookPayload } from '../inventory/inventory.use-cases';

@Injectable()
export class ProcessShopifyWebhookUseCase {
  constructor(
    private readonly config: ConfigService,
    @Inject(IWebhookDeliveryRepository)
    private readonly deliveries: IWebhookDeliveryRepository,
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
  ) {}

  async execute(input: {
    rawBody: Buffer;
    hmac: string;
    topic: string;
    shopDomain: string;
    eventId: string;
    triggeredAt?: string;
  }) {
    this.verifyHmac(input.rawBody, input.hmac);
    if (!input.topic || !input.shopDomain || !input.eventId)
      throw new BadRequestException('Headers de Shopify incompletos.');
    const existing = await this.deliveries.find(
      input.shopDomain,
      input.eventId,
    );
    if (existing) return { accepted: true, duplicate: true };
    const store = await this.stores.findByShopId(input.shopDomain);
    const payload = JSON.parse(input.rawBody.toString('utf8')) as Record<
      string,
      unknown
    >;
    const delivery = await this.deliveries.save(
      this.deliveries.create({
        tenantId: store?.tenantId ?? null,
        shopDomain: input.shopDomain,
        topic: input.topic,
        shopifyEventId: input.eventId,
        payloadHash: createHash('sha256').update(input.rawBody).digest('hex'),
        payload,
        status: 'QUEUED',
        triggeredAt: input.triggeredAt ? new Date(input.triggeredAt) : null,
        processedAt: null,
        error: null,
      }),
    );
    const queue =
      input.topic === 'app/uninstalled'
        ? QUEUE_NAMES.RECONCILIATION
        : input.topic.startsWith('products/')
          ? QUEUE_NAMES.PRODUCT_WEBHOOK
          : input.topic.startsWith('inventory_levels/')
            ? QUEUE_NAMES.INVENTORY_SYNC
            : QUEUE_NAMES.ORDER_SYNC;
    const inventoryItemId = input.topic.startsWith('inventory_levels/')
      ? inventoryItemIdFromWebhookPayload(payload)
      : '';
    const data = input.topic.startsWith('inventory_levels/')
      ? {
          deliveryId: delivery.id,
          tenantId: store?.tenantId ?? null,
          storeId: store?.id ?? null,
          inventoryItemId,
          origin: 'webhook',
          timestamp: new Date().toISOString(),
          eventId: input.eventId,
          deduplicationKey: `inventory-sync:${store?.id ?? input.shopDomain}:${inventoryItemId}`,
        }
      : {
        deliveryId: delivery.id,
        tenantId: store?.tenantId ?? null,
        storeId: store?.id ?? null,
        shopDomain: input.shopDomain,
        topic: input.topic,
        eventId: input.eventId,
        payload,
      };
    await this.queues.publish(
      queue,
      input.topic.startsWith('inventory_levels/')
        ? 'inventory-sync-requested'
        : input.topic,
      data as Record<string, unknown>,
      {
        jobId: `${store?.id ?? input.shopDomain}-${input.eventId}`.replace(
          /:/g,
          '-',
        ),
        attempts: 8,
        backoffMs: 2_000,
        deduplicationId: `webhook:${input.shopDomain}:${input.eventId}`,
        deduplicationTtl: 10_000,
      },
    );
    return { accepted: true, duplicate: false };
  }

  private verifyHmac(rawBody: Buffer, received: string) {
    const secret = this.config.getOrThrow<string>('SHOPIFY_API_SECRET');
    const expected = Buffer.from(
      createHmac('sha256', secret).update(rawBody).digest('base64'),
    );
    const actual = Buffer.from(received || '');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      throw new UnauthorizedException('Firma HMAC inválida.');
  }
}
