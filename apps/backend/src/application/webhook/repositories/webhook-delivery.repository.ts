import { WebhookDelivery } from '../../../domain/entities/notification.entity';

export abstract class IWebhookDeliveryRepository {
  abstract findById(id: string): Promise<WebhookDelivery | null>;
  abstract find(
    shopDomain: string,
    shopifyEventId: string,
  ): Promise<WebhookDelivery | null>;
  abstract create(input: Partial<WebhookDelivery>): WebhookDelivery;
  abstract save(delivery: WebhookDelivery): Promise<WebhookDelivery>;
}
