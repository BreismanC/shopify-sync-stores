import { BadRequestException, ConflictException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingStatus } from '../../domain/enums/onboarding-status.enum';
import { StoreRole } from '../../domain/enums/store-role.enum';
import {
  WebhookStatus,
  WebhookTopic,
} from '../../domain/enums/webhook-topic.enum';
import type {
  IStoreWebhookRepository,
  StoreWebhookRow,
  UpsertStoreWebhookInput,
} from '../store/repositories/IStoreWebhookRepository';
import type { IShopifyWebhookPort } from '../shopify/ports/shopify.ports';
import type { IRealtimePublisher } from '../ports/realtime-publisher.port';

describe('OnboardingService', () => {
  describe('upsertTenant', () => {
    it('should advance tenant onboardingStatus when owner completes step 1', async () => {
      const user = {
        id: 'user-uuid',
        tenantId: null as string | null,
      };
      const tenant = {
        id: 'tenant-uuid',
        name: 'Acme Inc',
        onboardingStatus: OnboardingStatus.PENDING_TENANT_CONFIG,
      };

      const userRepository = {
        findById: jest.fn().mockResolvedValue(user),
        save: jest.fn().mockImplementation(async (entity) => entity),
      };
      const tenantRepository = {
        findById: jest.fn().mockResolvedValue(tenant),
        save: jest.fn().mockImplementation(async (entity) => entity),
      };
      const tenantService = {
        upsertTenant: jest.fn().mockResolvedValue(tenant),
      };

      const service = new OnboardingService(
        userRepository as any,
        tenantRepository as any,
        {} as any, // IStoreRepository
        {} as any, // IStoreWebhookRepository
        {} as any, // ITeamMemberRepository
        {} as any, // ISubscriptionRepository
        {} as any, // SubscriptionService
        tenantService as any,
        {} as any, // MercadoPagoService
        {} as any, // MercadoPagoTokenService
        {} as any, // TeamInvitationService
        {} as any, // IShopifyWebhookPort
        {} as any, // IRealtimePublisher
      );

      const result = await service.upsertTenant(user.id, { name: tenant.name });

      expect(tenantService.upsertTenant).toHaveBeenCalledWith(
        user.id,
        tenant.name,
      );
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenant.id,
        }),
      );
      expect(tenantRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardingStatus: OnboardingStatus.PENDING_PLAN_SELECTION,
        }),
      );
      expect(result).toEqual({
        tenant,
        onboardingStatus: OnboardingStatus.PENDING_PLAN_SELECTION,
      });
    });
  });

  describe('connectStore / webhooks', () => {
    // Shopify rechaza callbacks locales, y el service corta antes de llamar a
    // la API cuando detecta uno. Los tests necesitan una URL pública para
    // ejercitar el camino real de registro.
    function publicUrlConfig() {
      return {
        get: jest.fn((key: string) =>
          key === 'BACKEND_PUBLIC_URL'
            ? 'https://sss.example.com'
            : undefined,
        ),
      };
    }

    function buildService(opts: {
      webhooksRepo: Partial<IStoreWebhookRepository>;
      shopifyWebhook: Partial<IShopifyWebhookPort>;
      realtime?: Partial<IRealtimePublisher>;
      config?: { get: (key: string) => string | undefined };
      stores?: any[];
      queueInitialSync?: { execute: jest.Mock };
      onboardingStatus?: OnboardingStatus;
    }) {
      const userRepository = {
        findById: jest.fn().mockResolvedValue({
          id: 'user-uuid',
          tenantId: 'tenant-uuid',
        }),
        save: jest.fn().mockImplementation(async (entity) => entity),
      };
      const tenantRepository = {
        findById: jest.fn().mockResolvedValue({
          id: 'tenant-uuid',
          onboardingStatus:
            opts.onboardingStatus ?? OnboardingStatus.PENDING_STORE_CONFIG,
        }),
        save: jest.fn().mockImplementation(async (entity) => entity),
      };
      const storeRepository = {
        findByShopId: jest.fn().mockResolvedValue(null),
        findByTenantId: jest.fn().mockResolvedValue(opts.stores ?? []),
        create: jest.fn().mockImplementation((dto) => dto),
        save: jest.fn().mockImplementation(async (entity) => ({
          ...entity,
          id: 'store-uuid',
        })),
      };

      const ensureTenantStatusAtLeast = jest
        .fn()
        .mockResolvedValue(OnboardingStatus.PENDING_STORE_ROLE);

      const service = new OnboardingService(
        userRepository as any,
        tenantRepository as any,
        storeRepository as any,
        opts.webhooksRepo as IStoreWebhookRepository,
        {} as any,
        {} as any,
        {} as any,
        {
          upsertTenant: jest.fn(),
        } as any,
        {} as any,
        {} as any,
        {} as any,
        opts.shopifyWebhook as IShopifyWebhookPort,
        (opts.realtime ?? {
          publishToTenant: jest.fn().mockResolvedValue(undefined),
          publishToUser: jest.fn().mockResolvedValue(undefined),
        }) as IRealtimePublisher,
        (opts.config ?? publicUrlConfig()) as any,
        { countProducts: jest.fn().mockResolvedValue(0) } as any,
        opts.queueInitialSync as any,
      );

      // Inyectamos manualmente un helper para no depender del orden de
      // declaración de propiedades. El service real lo define como método
      // privado, pero acá evitamos tocar la implementación.
      (service as any).ensureTenantStatusAtLeast = ensureTenantStatusAtLeast;

      return { service, ensureTenantStatusAtLeast };
    }

    it('inicia la sincronización inicial sólo sobre la tienda propia después de guardar el rol', async () => {
      const queueInitialSync = {
        execute: jest.fn().mockResolvedValue({ id: 'initial-sync-1' }),
      };
      const { service } = buildService({
        webhooksRepo: { listByStore: jest.fn().mockResolvedValue([]) },
        shopifyWebhook: {},
        stores: [
          {
            id: 'own-store',
            tenantId: 'tenant-uuid',
            role: StoreRole.SOURCE,
            isActive: true,
          },
        ],
        queueInitialSync,
        onboardingStatus: OnboardingStatus.PENDING_STORE_ROLE,
      });

      await service.setStoreRole('user-uuid', {
        storeId: 'own-store',
        role: StoreRole.VENDOR,
      });

      expect(queueInitialSync.execute).toHaveBeenCalledWith(
        'tenant-uuid',
        'store-uuid',
      );
    });

    it('no inicia sincronizaciones mientras la tienda aún no tiene un rol confirmado', async () => {
      const queueInitialSync = {
        execute: jest.fn().mockResolvedValue({ id: 'initial-sync-1' }),
      };
      const { service } = buildService({
        webhooksRepo: {
          upsert: jest.fn().mockImplementation(async (input) => ({
            id: `webhook-${input.topic}`,
            ...input,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          listByStore: jest.fn().mockResolvedValue([]),
        },
        shopifyWebhook: {
          register: jest.fn(async (_credentials, topic) => `webhook-${topic}`),
        },
        queueInitialSync,
      });

      await service.connectStore('user-uuid', {
        shopifyShopUrl: 'demo.myshopify.com',
        shopifyAccessToken: 'shpat_demo_token',
      });

      expect(queueInitialSync.execute).not.toHaveBeenCalled();
    });

    it('persiste todos los webhooks como CONNECTED y avanza el status', async () => {
      const webhooks = new Map<string, StoreWebhookRow>();
      const upsert = jest.fn(
        async (input: UpsertStoreWebhookInput): Promise<StoreWebhookRow> => {
          const row: StoreWebhookRow = {
            id: `row-${webhooks.size + 1}`,
            storeId: input.storeId,
            topic: input.topic,
            callbackUrl: input.callbackUrl,
            shopifyWebhookId: input.shopifyWebhookId,
            status: input.status,
            lastError: input.lastError,
            attempts: input.attempts,
            lastAttemptAt: input.lastAttemptAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          webhooks.set(`${input.storeId}:${input.topic}`, row);
          return row;
        },
      );

      const shopifyWebhook: Partial<IShopifyWebhookPort> = {
        register: jest.fn(async (_creds, topic) => `gid://shopify/Webhook/${topic}`),
      };

      const { service, ensureTenantStatusAtLeast } = buildService({
        webhooksRepo: { upsert, listByStore: jest.fn(async (id) =>
          Array.from(webhooks.values()).filter((r) => r.storeId === id),
        ) },
        shopifyWebhook,
      });

      const result = await service.connectStore('user-uuid', {
        shopifyShopUrl: 'demo.myshopify.com',
        shopifyAccessToken: 'shpat_demo_token',
      });

      expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_STORE_ROLE);
      // Por cada topic hicimos al menos 2 upserts: seed PENDING + CONNECTED.
      expect(upsert.mock.calls.length).toBeGreaterThanOrEqual(
        Object.values(WebhookTopic).length * 2,
      );
      // Todos los registros finales deberían estar CONNECTED.
      const connected = Array.from(webhooks.values()).filter(
        (r) => r.status === WebhookStatus.CONNECTED,
      );
      expect(connected).toHaveLength(Object.values(WebhookTopic).length);
      expect(shopifyWebhook.register).toHaveBeenCalledTimes(
        Object.values(WebhookTopic).length,
      );
      expect(ensureTenantStatusAtLeast).toHaveBeenCalledWith(
        'tenant-uuid',
        OnboardingStatus.PENDING_STORE_ROLE,
      );
    });

    it('bloquea connectStore con 400 si algún webhook obligatorio queda FAILED', async () => {
      const upsert = jest.fn(
        async (input: UpsertStoreWebhookInput): Promise<StoreWebhookRow> => ({
          id: `row-${Math.random()}`,
          storeId: input.storeId,
          topic: input.topic,
          callbackUrl: input.callbackUrl,
          shopifyWebhookId: input.shopifyWebhookId,
          status: input.status,
          lastError: input.lastError,
          attempts: input.attempts,
          lastAttemptAt: input.lastAttemptAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const failingTopics = new Set<WebhookTopic>([
        WebhookTopic.PRODUCTS_CREATE,
        WebhookTopic.ORDERS_CREATE,
      ]);
      const shopifyWebhook: Partial<IShopifyWebhookPort> = {
        register: jest.fn(async (_creds, topic) => {
          if (failingTopics.has(topic)) {
            throw new Error(`Shopify dijo que no para ${topic}`);
          }
          return `gid://shopify/Webhook/${topic}`;
        }),
      };

      const { service } = buildService({
        webhooksRepo: { upsert, listByStore: jest.fn().mockResolvedValue([]) },
        shopifyWebhook,
      });

      await expect(
        service.connectStore('user-uuid', {
          shopifyShopUrl: 'demo.myshopify.com',
          shopifyAccessToken: 'shpat_demo_token',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // El FAILED debe haber quedado persistido.
      const failedRows = upsert.mock.calls
        .map((call) => call[0])
        .filter((input) => input.status === WebhookStatus.FAILED);
      expect(failedRows).toHaveLength(failingTopics.size);
    });

    it('no llama a Shopify y explica el motivo si el callback no es público', async () => {
      const upsert = jest.fn(
        async (input: UpsertStoreWebhookInput): Promise<StoreWebhookRow> => ({
          id: `row-${Math.random()}`,
          storeId: input.storeId,
          topic: input.topic,
          callbackUrl: input.callbackUrl,
          shopifyWebhookId: input.shopifyWebhookId,
          status: input.status,
          lastError: input.lastError,
          attempts: input.attempts,
          lastAttemptAt: input.lastAttemptAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      const shopifyWebhook: Partial<IShopifyWebhookPort> = {
        register: jest.fn(),
      };

      const { service } = buildService({
        webhooksRepo: { upsert, listByStore: jest.fn().mockResolvedValue([]) },
        shopifyWebhook,
        // Sin BACKEND_PUBLIC_URL el service cae al default de localhost.
        config: { get: () => undefined },
      });

      await expect(
        service.connectStore('user-uuid', {
          shopifyShopUrl: 'demo.myshopify.com',
          shopifyAccessToken: 'shpat_demo_token',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(shopifyWebhook.register).not.toHaveBeenCalled();

      const failedRows = upsert.mock.calls
        .map((call) => call[0])
        .filter((input) => input.status === WebhookStatus.FAILED);
      expect(failedRows).toHaveLength(Object.values(WebhookTopic).length);
      expect(failedRows[0].lastError).toContain('BACKEND_PUBLIC_URL');
    });

    it('confirmStore rechaza con 409 si hay webhooks obligatorios sin conectar', async () => {
      const webhooks: StoreWebhookRow[] = Object.values(WebhookTopic).map(
        (topic, idx) => ({
          id: `row-${idx}`,
          storeId: 'store-uuid',
          topic,
          callbackUrl: 'https://example.com/api/webhooks/shopify',
          shopifyWebhookId:
            topic === WebhookTopic.PRODUCTS_CREATE
              ? null
              : `gid://shopify/Webhook/${topic}`,
          status:
            topic === WebhookTopic.PRODUCTS_CREATE
              ? WebhookStatus.PENDING
              : WebhookStatus.CONNECTED,
          lastError: null,
          attempts: 1,
          lastAttemptAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const storeRepository = {
        findByTenantId: jest.fn().mockResolvedValue([
          {
            id: 'store-uuid',
            tenantId: 'tenant-uuid',
            shopifyShopId: 'demo.myshopify.com',
            accessToken: 'token',
            role: StoreRole.SOURCE,
            isActive: true,
          },
        ]),
      };

      const service = new OnboardingService(
        {
          findById: jest.fn().mockResolvedValue({
            id: 'user-uuid',
            tenantId: 'tenant-uuid',
          }),
        } as any,
        { findById: jest.fn(), save: jest.fn() } as any,
        storeRepository as any,
        { listByStore: jest.fn().mockResolvedValue(webhooks) } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { publishToTenant: jest.fn(), publishToUser: jest.fn() } as any,
      );

      await expect(service.confirmStore('user-uuid')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('emite el evento realtime store.webhook.upsert por cada webhook registrado', async () => {
      const publishToTenant = jest.fn().mockResolvedValue(undefined);
      const publishToUser = jest.fn().mockResolvedValue(undefined);

      const upsert = jest.fn(
        async (input: UpsertStoreWebhookInput): Promise<StoreWebhookRow> => ({
          id: `row-${Math.random()}`,
          storeId: input.storeId,
          topic: input.topic,
          callbackUrl: input.callbackUrl,
          shopifyWebhookId: input.shopifyWebhookId,
          status: input.status,
          lastError: input.lastError,
          attempts: input.attempts,
          lastAttemptAt: input.lastAttemptAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const shopifyWebhook: Partial<IShopifyWebhookPort> = {
        register: jest.fn(async (_creds, topic) => `gid://shopify/Webhook/${topic}`),
      };

      buildService({
        webhooksRepo: { upsert, listByStore: jest.fn().mockResolvedValue([]) },
        shopifyWebhook,
        realtime: { publishToTenant, publishToUser },
      });

      const userRepository = {
        findById: jest.fn().mockResolvedValue({
          id: 'user-uuid',
          tenantId: 'tenant-uuid',
        }),
      };
      const tenantRepository = {
        findById: jest.fn().mockResolvedValue({
          id: 'tenant-uuid',
          onboardingStatus: OnboardingStatus.PENDING_STORE_CONFIG,
        }),
        save: jest.fn().mockImplementation(async (e) => e),
      };
      const storeRepository = {
        findByShopId: jest.fn().mockResolvedValue(null),
        findByTenantId: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((dto) => dto),
        save: jest.fn().mockImplementation(async (entity) => ({
          ...entity,
          id: 'store-uuid',
        })),
      };
      const service = new OnboardingService(
        userRepository as any,
        tenantRepository as any,
        storeRepository as any,
        { upsert, listByStore: jest.fn().mockResolvedValue([]) } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        shopifyWebhook as IShopifyWebhookPort,
        { publishToTenant, publishToUser } as IRealtimePublisher,
        publicUrlConfig() as any,
      );
      (service as any).ensureTenantStatusAtLeast = jest
        .fn()
        .mockResolvedValue(OnboardingStatus.PENDING_STORE_ROLE);

      await service.connectStore('user-uuid', {
        shopifyShopUrl: 'demo.myshopify.com',
        shopifyAccessToken: 'shpat_demo_token',
      });

      // Cada topic genera al menos 1 publicación a `tenant` (seed) + 1 al
      // terminar (CONNECTED o FAILED).
      expect(publishToTenant).toHaveBeenCalled();
      const events = publishToTenant.mock.calls.map((call) => call[1]);
      expect(events.every((evt) => evt === 'store.webhook.upsert')).toBe(true);
    });
  });
});
