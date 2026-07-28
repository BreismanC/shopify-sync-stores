import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ProcessShopifyWebhookUseCase } from './process-shopify-webhook.use-case';

describe('ProcessShopifyWebhookUseCase', () => {
  const secret = 'test-shopify-secret';
  const payload = Buffer.from(JSON.stringify({ id: 123, title: 'Product' }));
  const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('base64');

  function setup(existing: any = null) {
    const deliveries = {
      find: jest.fn().mockResolvedValue(existing),
      create: jest.fn((value) => ({ id: 'delivery-1', ...value })),
      save: jest.fn(async (value) => value),
    };
    const stores = {
      findByShopId: jest
        .fn()
        .mockResolvedValue({ id: 'store-1', tenantId: 'tenant-1' }),
    };
    const queues = { publish: jest.fn().mockResolvedValue('job-1') };
    const config = { getOrThrow: jest.fn().mockReturnValue(secret) };
    return {
      useCase: new ProcessShopifyWebhookUseCase(
        config as any,
        deliveries as any,
        stores as any,
        queues as any,
      ),
      deliveries,
      queues,
    };
  }

  it('rechaza una firma HMAC inválida', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({
        rawBody: payload,
        hmac: 'invalid',
        topic: 'products/update',
        shopDomain: 'shop.myshopify.com',
        eventId: 'evt-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deduplica por tienda y X-Shopify-Event-Id', async () => {
    const { useCase, queues } = setup({ id: 'existing' });
    await expect(
      useCase.execute({
        rawBody: payload,
        hmac: signature,
        topic: 'products/update',
        shopDomain: 'shop.myshopify.com',
        eventId: 'evt-1',
      }),
    ).resolves.toEqual({ accepted: true, duplicate: true });
    expect(queues.publish).not.toHaveBeenCalled();
  });

  it('persiste y encola un evento válido', async () => {
    const { useCase, deliveries, queues } = setup();
    await expect(
      useCase.execute({
        rawBody: payload,
        hmac: signature,
        topic: 'products/update',
        shopDomain: 'shop.myshopify.com',
        eventId: 'evt-1',
      }),
    ).resolves.toEqual({ accepted: true, duplicate: false });
    expect(deliveries.save).toHaveBeenCalledWith(
      expect.objectContaining({ shopifyEventId: 'evt-1', status: 'QUEUED' }),
    );
    expect(queues.publish).toHaveBeenCalledWith(
      'product-webhook',
      'products/update',
      expect.objectContaining({ eventId: 'evt-1' }),
      expect.objectContaining({
        jobId: 'store-1-evt-1',
        deduplicationId: 'webhook:shop.myshopify.com:evt-1',
      }),
    );
  });

  it('encola inventario como InventorySyncRequested', async () => {
    const inventoryPayload = Buffer.from(
      JSON.stringify({ inventory_item_id: 12345, available: 99 }),
    );
    const inventorySignature = createHmac('sha256', secret)
      .update(inventoryPayload)
      .digest('base64');
    const { useCase, queues } = setup();

    await expect(
      useCase.execute({
        rawBody: inventoryPayload,
        hmac: inventorySignature,
        topic: 'inventory_levels/update',
        shopDomain: 'shop.myshopify.com',
        eventId: 'evt-inventory-1',
      }),
    ).resolves.toEqual({ accepted: true, duplicate: false });

    expect(queues.publish).toHaveBeenCalledWith(
      'inventory-sync',
      'inventory-sync-requested',
      expect.objectContaining({
        storeId: 'store-1',
        inventoryItemId: 'gid://shopify/InventoryItem/12345',
        origin: 'webhook',
        eventId: 'evt-inventory-1',
      }),
      expect.objectContaining({
        deduplicationId: 'webhook:shop.myshopify.com:evt-inventory-1',
      }),
    );
  });
});
