import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookDelivery } from '../../../domain/entities/notification.entity';
import { IWebhookDeliveryRepository } from '../../../application/webhook/repositories/webhook-delivery.repository';

@Injectable()
export class TypeOrmWebhookDeliveryRepository implements IWebhookDeliveryRepository {
  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly repository: Repository<WebhookDelivery>,
  ) {}
  find(shopDomain: string, shopifyEventId: string) {
    return this.repository.findOne({ where: { shopDomain, shopifyEventId } });
  }
  create(input: Partial<WebhookDelivery>) {
    return this.repository.create(input);
  }
  save(delivery: WebhookDelivery) {
    return this.repository.save(delivery);
  }
}
