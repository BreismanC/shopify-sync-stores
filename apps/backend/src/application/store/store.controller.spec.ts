import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StoreController } from './store.controller';
import { IStoreRepository } from './repositories/IStoreRepository';
import { StoreConnectionService } from './store-connection.service';

describe('StoreController.getMyStore (dashboard endpoint)', () => {
  let controller: StoreController;
  let storeRepository: jest.Mocked<IStoreRepository>;

  const tenantId = 'tenant-uuid';

  beforeEach(async () => {
    storeRepository = {
      findByTenantId: jest.fn(),
      findByShopId: jest.fn(),
      findByStoreKey: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoreController],
      providers: [
        {
          provide: IStoreRepository,
          useValue: storeRepository,
        },
        {
          provide: StoreConnectionService,
          useValue: {} as any,
        },
      ],
    }).compile();

    controller = module.get<StoreController>(StoreController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy path', () => {
    it('devuelve la tienda del tenant cuando existe', async () => {
      const store = {
        id: 'store-uuid',
        shopifyShopId: 'mi-tienda.myshopify.com',
        role: 'SOURCE',
        isActive: true,
        tenantId,
        tenant: null,
        accessToken: 'encrypted',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      storeRepository.findByTenantId.mockResolvedValue([store]);

      const result = await controller.getMyStore({
        user: { id: 'user-uuid', tenantId },
      } as any);

      expect(storeRepository.findByTenantId).toHaveBeenCalledWith(tenantId);
      expect(result.store).toEqual(
        expect.objectContaining({
          id: 'store-uuid',
          shopifyShopId: 'mi-tienda.myshopify.com',
          role: 'SOURCE',
          isActive: true,
          tenantId,
        }),
      );
      expect(result.store).not.toHaveProperty('accessToken');
    });

    it('soporta tiendas VENDOR', async () => {
      const store = {
        id: 'store-uuid',
        shopifyShopId: 'vendor.myshopify.com',
        role: 'VENDOR',
        isActive: true,
        tenantId,
        tenant: null,
        accessToken: 'encrypted',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      storeRepository.findByTenantId.mockResolvedValue([store]);

      const result = await controller.getMyStore({
        user: { id: 'user-uuid', tenantId },
      } as any);

      expect(result.store.role).toBe('VENDOR');
      expect(result.store).not.toHaveProperty('accessToken');
    });

    it('devuelve la primera tienda si el tenant tiene más de una registrada', async () => {
      const stores = [
        {
          id: 'store-1',
          shopifyShopId: 'a.myshopify.com',
          role: 'SOURCE',
          tenantId,
          isActive: true,
        },
        {
          id: 'store-2',
          shopifyShopId: 'b.myshopify.com',
          role: 'VENDOR',
          tenantId,
          isActive: false,
        },
      ];
      storeRepository.findByTenantId.mockResolvedValue(stores as any);

      const result = await controller.getMyStore({
        user: { id: 'user-uuid', tenantId },
      } as any);

      expect(result.store.id).toBe('store-1');
    });
  });

  describe('404 cuando no hay tienda (caso patológico post-onboarding)', () => {
    it('lanza NotFoundException con code STORE_NOT_FOUND si el array está vacío', async () => {
      storeRepository.findByTenantId.mockResolvedValue([]);

      let caught: any;
      try {
        await controller.getMyStore({
          user: { id: 'user-uuid', tenantId },
        } as any);
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(NotFoundException);
      const response = caught.getResponse();
      expect(response.code).toBe('STORE_NOT_FOUND');
      expect(response.message).toContain('tienda');
    });

    it('lanza NotFoundException si el user no tiene tenantId', async () => {
      let caught: any;
      try {
        await controller.getMyStore({
          user: { id: 'user-uuid', tenantId: undefined },
        } as any);
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(NotFoundException);
      const response = caught.getResponse();
      expect(response.code).toBe('STORE_NOT_FOUND');
      // No debe llegar a la DB si no hay tenantId
      expect(storeRepository.findByTenantId).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si tenantId es null', async () => {
      let caught: any;
      try {
        await controller.getMyStore({
          user: { id: 'user-uuid', tenantId: null },
        } as any);
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(NotFoundException);
      expect(storeRepository.findByTenantId).not.toHaveBeenCalled();
    });
  });
});
