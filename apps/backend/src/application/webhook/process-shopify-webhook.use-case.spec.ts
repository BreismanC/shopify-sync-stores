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
      expect.objectContaining({ jobId: 'evt-1' }),
    );
  });
});
