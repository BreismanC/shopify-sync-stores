import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookDelivery } from '../../domain/entities/notification.entity';
import { TypeOrmWebhookDeliveryRepository } from '../../infrastructure/repositories/webhook/typeorm-webhook-delivery.repository';
import { StoreModule } from '../store/store.module';
import { ProcessShopifyWebhookUseCase } from './process-shopify-webhook.use-case';
import { IWebhookDeliveryRepository } from './repositories/webhook-delivery.repository';
import { ShopifyWebhookController } from './shopify-webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookDelivery]), StoreModule],
  controllers: [ShopifyWebhookController],
  providers: [
    TypeOrmWebhookDeliveryRepository,
    {
      provide: IWebhookDeliveryRepository,
      useExisting: TypeOrmWebhookDeliveryRepository,
    },
    ProcessShopifyWebhookUseCase,
  ],
  exports: [IWebhookDeliveryRepository],
})
export class WebhookModule {}
