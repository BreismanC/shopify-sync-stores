import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShopifyAdminAdapter } from '../../infrastructure/shopify/shopify-admin.adapter';
import {
  IShopifyCustomerPort,
  IShopifyInventoryPort,
  IShopifyOrderPort,
  IShopifyProductPort,
  IShopifyWebhookPort,
} from './ports/shopify.ports';

@Module({
  imports: [ConfigModule],
  providers: [
    ShopifyAdminAdapter,
    { provide: IShopifyProductPort, useExisting: ShopifyAdminAdapter },
    { provide: IShopifyOrderPort, useExisting: ShopifyAdminAdapter },
    { provide: IShopifyInventoryPort, useExisting: ShopifyAdminAdapter },
    { provide: IShopifyWebhookPort, useExisting: ShopifyAdminAdapter },
    { provide: IShopifyCustomerPort, useExisting: ShopifyAdminAdapter },
  ],
  exports: [
    IShopifyProductPort,
    IShopifyOrderPort,
    IShopifyInventoryPort,
    IShopifyWebhookPort,
    IShopifyCustomerPort,
  ],
})
export class ShopifyModule {}
