import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StoreConnectionService } from './store-connection.service';
import { StoreRole } from '../../domain/enums/store-role.enum';
import { UserRole } from '../../domain/enums/user-role.enum';
import { Store } from '../../domain/entities/store.entity';

describe('StoreConnectionService', () => {
  const TENANT_A = 'tenant-a';
  const TENANT_B = 'tenant-b';

  const admin = (overrides: Partial<any> = {}) =>
    ({
      id: 'user-admin',
      tenantId: TENANT_A,
      role: UserRole.ADMIN,
      email: 'admin@a.com',
      name: 'Admin',
      ...overrides,
    }) as any;

  const member = () =>
    ({
      id: 'user-member',
      tenantId: TENANT_A,
      role: UserRole.MEMBER,
    }) as any;

  function buildService(
    opts: {
      stores?: any[];
      currentStore?: any;
      pair?: any;
      emailSend?: jest.Mock;
    } = {},
  ) {
    const stores: any[] = opts.stores ?? [];
    const storeRepository = {
      findByTenantId: jest.fn(async (tenantId: string) =>
        stores.filter((s) => s.tenantId === tenantId),
      ),
      findByStoreKey: jest.fn(),
    } as any;

    const connectionRepository = {
      findPair: jest.fn(async () => opts.pair ?? null),
      create: jest.fn((data: any) => ({ id: 'conn-id', ...data })),
      save: jest.fn(async (entity: any) => ({ ...entity })),
      findConnectedByStore: jest.fn(),
      findAccessibleByStore: jest.fn(),
      hasActiveConnection: jest.fn(),
    } as any;

    const userRepository = {
      findById: jest.fn(),
    } as any;

    const emailService = {
      sendStoreConnectionKeyEmail:
        opts.emailSend ?? jest.fn(async () => undefined),
    } as any;

    const service = new StoreConnectionService(
      storeRepository,
      connectionRepository,
      emailService,
    );

    return {
      service,
      storeRepository,
      connectionRepository,
      userRepository,
      emailService,
    };
  }

  function buildStore(overrides: Partial<Store> = {}): any {
    return {
      id: overrides.id ?? 'store-id',
      shopifyShopId: overrides.shopifyShopId ?? 'mi-tienda.myshopify.com',
      role: overrides.role ?? StoreRole.SOURCE,
      isActive: true,
      storeKey: overrides.storeKey ?? 'AAAA',
      tenantId: overrides.tenantId ?? TENANT_A,
      accessToken: 'secret',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  describe('listConnections', () => {
    it('lista conexiones paginadas de la tienda actual', async () => {
      const current = buildStore({ id: 's-current' });
      const connectionRepository = {
        findConnectedByStore: jest.fn(async () => ({
          data: [
            {
              id: 'c-1',
              storeId: 's-peer',
              shopifyShopId: 'peer.myshopify.com',
              role: 'VENDOR',
              isActive: true,
              connectedAt: new Date(),
              disconnectedAt: null,
            },
          ],
          total: 1,
        })),
      } as any;

      const service = new StoreConnectionService(
        { findByTenantId: jest.fn(async () => [current]) } as any,
        connectionRepository,
        {} as any,
      );

      const result = await service.listConnections(TENANT_A, {
        search: undefined,
        page: 1,
        perPage: 10,
        sortBy: 'connectedAt',
        order: 'desc',
      });

      expect(connectionRepository.findConnectedByStore).toHaveBeenCalledWith(
        's-current',
        expect.any(Object),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].role).toBe('VENDOR');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe('connectByStoreKey', () => {
    it('rechaza la propia storeKey', async () => {
      const current = buildStore({ id: 's-current', storeKey: 'KEY1' });
      const { service, storeRepository } = buildService({
        stores: [current],
      });
      storeRepository.findByStoreKey.mockResolvedValue(
        buildStore({
          id: 's-current',
          storeKey: 'KEY1',
          tenantId: TENANT_A,
          role: StoreRole.SOURCE,
        }),
      );

      await expect(
        service.connectByStoreKey(admin(), 'key1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza cuando el target es del mismo tenant', async () => {
      const current = buildStore({ id: 's-current', storeKey: 'KEY1' });
      const target = buildStore({
        id: 's-other',
        storeKey: 'KEY2',
        tenantId: TENANT_A,
        role: StoreRole.VENDOR,
      });
      const { service, storeRepository } = buildService({
        stores: [current],
      });
      storeRepository.findByStoreKey.mockResolvedValue(target);

      await expect(
        service.connectByStoreKey(admin(), 'KEY2'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza SOURCE↔SOURCE', async () => {
      const current = buildStore({ id: 's-current', storeKey: 'KEY1' });
      const target = buildStore({
        id: 's-other',
        storeKey: 'KEY2',
        tenantId: TENANT_B,
        role: StoreRole.SOURCE,
      });
      const { service, storeRepository } = buildService({
        stores: [current],
      });
      storeRepository.findByStoreKey.mockResolvedValue(target);

      await expect(
        service.connectByStoreKey(admin(), 'KEY2'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza VENDOR↔VENDOR', async () => {
      const current = buildStore({
        id: 's-current',
        storeKey: 'KEY1',
        role: StoreRole.VENDOR,
      });
      const target = buildStore({
        id: 's-other',
        storeKey: 'KEY2',
        tenantId: TENANT_B,
        role: StoreRole.VENDOR,
      });
      const { service, storeRepository } = buildService({
        stores: [current],
      });
      storeRepository.findByStoreKey.mockResolvedValue(target);

      await expect(
        service.connectByStoreKey(admin(), 'KEY2'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lanza 404 si la storeKey no existe', async () => {
      const current = buildStore({ id: 's-current' });
      const { service, storeRepository } = buildService({ stores: [current] });
      storeRepository.findByStoreKey.mockResolvedValue(null);

      await expect(
        service.connectByStoreKey(admin(), 'NOPE'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('crea la conexión SOURCE↔VENDOR cuando current es SOURCE', async () => {
      const current = buildStore({ id: 's-current', role: StoreRole.SOURCE });
      const target = buildStore({
        id: 's-target',
        storeKey: 'KEY2',
        tenantId: TENANT_B,
        role: StoreRole.VENDOR,
      });
      const { service, storeRepository, connectionRepository } = buildService({
        stores: [current],
      });
      storeRepository.findByStoreKey.mockResolvedValue(target);

      const result = await service.connectByStoreKey(admin(), 'KEY2');

      expect(connectionRepository.findPair).toHaveBeenCalledWith(
        's-current',
        's-target',
      );
      expect(connectionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceStoreId: 's-current',
          vendorStoreId: 's-target',
          initiatedByStoreId: 's-current',
          isActive: true,
        }),
      );
      expect(result.connection.id).toBe('conn-id');
      expect(result.store.id).toBe('s-target');
    });

    it('crea la conexión VENDOR↔SOURCE cuando current es VENDOR (dirección inversa)', async () => {
      const current = buildStore({
        id: 's-vendor',
        role: StoreRole.VENDOR,
      });
      const target = buildStore({
        id: 's-source',
        storeKey: 'KEY2',
        tenantId: TENANT_B,
        role: StoreRole.SOURCE,
      });
      const { service, storeRepository, connectionRepository } = buildService({
        stores: [current],
      });
      storeRepository.findByStoreKey.mockResolvedValue(target);

      const result = await service.connectByStoreKey(admin(), 'KEY2');

      expect(connectionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceStoreId: 's-source',
          vendorStoreId: 's-vendor',
          initiatedByStoreId: 's-vendor',
        }),
      );
      expect(result.connection.sourceStoreId).toBe('s-source');
      expect(result.connection.vendorStoreId).toBe('s-vendor');
    });

    it('rechaza conexión duplicada activa con ConflictException CONNECTION_ALREADY_EXISTS', async () => {
      const current = buildStore({ id: 's-current', role: StoreRole.SOURCE });
      const target = buildStore({
        id: 's-target',
        storeKey: 'KEY2',
        tenantId: TENANT_B,
        role: StoreRole.VENDOR,
      });
      const { service, storeRepository, connectionRepository } = buildService({
        stores: [current],
        pair: {
          id: 'existing',
          sourceStoreId: 's-current',
          vendorStoreId: 's-target',
          isActive: true,
        },
      });
      storeRepository.findByStoreKey.mockResolvedValue(target);

      try {
        await service.connectByStoreKey(admin(), 'KEY2');
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        const r = err.getResponse();
        expect(r.code).toBe('CONNECTION_ALREADY_EXISTS');
      }
      expect(connectionRepository.save).not.toHaveBeenCalled();
    });

    it('reactiva una conexión inactiva (reactivation)', async () => {
      const current = buildStore({ id: 's-current', role: StoreRole.SOURCE });
      const target = buildStore({
        id: 's-target',
        storeKey: 'KEY2',
        tenantId: TENANT_B,
        role: StoreRole.VENDOR,
      });
      const inactive = {
        id: 'inactive-id',
        sourceStoreId: 's-current',
        vendorStoreId: 's-target',
        isActive: false,
        disconnectedAt: new Date(),
        connectedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      };
      const { service, storeRepository, connectionRepository } = buildService({
        stores: [current],
        pair: inactive,
      });
      storeRepository.findByStoreKey.mockResolvedValue(target);

      const result = await service.connectByStoreKey(admin(), 'KEY2');

      expect(connectionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'inactive-id',
          isActive: true,
          disconnectedAt: null,
        }),
      );
      expect(result.connection.id).toBe('inactive-id');
    });

    it('rechaza cuando user es MEMBER (Forbidden)', async () => {
      const { service } = buildService();
      await expect(
        service.connectByStoreKey(member(), 'KEY2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('sendStoreKeyByEmail', () => {
    it('envía la key de la tienda actual y NO crea conexión', async () => {
      const current = buildStore({
        id: 's-current',
        role: StoreRole.SOURCE,
        storeKey: 'ABCD',
      });
      const emailSend = jest.fn(async () => undefined);
      const { service, storeRepository, connectionRepository } = buildService({
        stores: [current],
        emailSend,
      });
      storeRepository.findByStoreKey.mockResolvedValue(
        buildStore({
          id: 's-target',
          storeKey: 'ZZZZ',
          tenantId: TENANT_B,
          role: StoreRole.VENDOR,
        }),
      );

      const result = await service.sendStoreKeyByEmail(admin(), 'a@a.com');

      expect(emailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@a.com',
          storeKey: 'ABCD',
          role: StoreRole.SOURCE,
        }),
      );
      expect(connectionRepository.create).not.toHaveBeenCalled();
      expect(connectionRepository.save).not.toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });

    it('rechaza MEMBER', async () => {
      const { service } = buildService();
      await expect(
        service.sendStoreKeyByEmail(member(), 'a@a.com'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('disconnect', () => {
    it('marca isActive=false y disconnectedAt para conexiones accesibles', async () => {
      const current = buildStore({ id: 's-current', role: StoreRole.SOURCE });
      const connection = {
        id: 'conn-1',
        sourceStoreId: 's-current',
        vendorStoreId: 's-target',
        isActive: true,
        disconnectedAt: null,
        connectedAt: new Date(),
      };
      const { service, connectionRepository } = buildService({
        stores: [current],
      });
      connectionRepository.findAccessibleByStore.mockResolvedValue(connection);

      const result = await service.disconnect(admin(), 'conn-1');

      expect(connectionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conn-1',
          isActive: false,
          disconnectedAt: expect.any(Date),
        }),
      );
      expect(result.connection.isActive).toBe(false);
    });

    it('lanza 404 si la conexión no pertenece a la tienda actual', async () => {
      const current = buildStore({ id: 's-current' });
      const { service, connectionRepository } = buildService({
        stores: [current],
      });
      connectionRepository.findAccessibleByStore.mockResolvedValue(null);

      await expect(
        service.disconnect(admin(), 'inaccessible'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza desconectar cuando ya está inactiva', async () => {
      const current = buildStore({ id: 's-current' });
      const connection = {
        id: 'conn-1',
        sourceStoreId: 's-current',
        vendorStoreId: 's-target',
        isActive: false,
        disconnectedAt: new Date(),
        connectedAt: new Date(),
      };
      const { service, connectionRepository } = buildService({
        stores: [current],
      });
      connectionRepository.findAccessibleByStore.mockResolvedValue(connection);

      try {
        await service.disconnect(admin(), 'conn-1');
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
      }
    });
  });

  describe('hasActiveConnection', () => {
    it('delegates en el repositorio', async () => {
      const { service, connectionRepository } = buildService();
      connectionRepository.hasActiveConnection.mockResolvedValue(true);
      const ok = await service.hasActiveConnection('s-current', 'c-1');
      expect(connectionRepository.hasActiveConnection).toHaveBeenCalledWith(
        's-current',
        'c-1',
      );
      expect(ok).toBe(true);
    });
  });

  describe('getCurrentStore', () => {
    it('devuelve la primera tienda del tenant', async () => {
      const s = buildStore({ id: 's-1' });
      const { service, storeRepository } = buildService();
      storeRepository.findByTenantId.mockResolvedValue([s]);
      const result = await service.getCurrentStore(TENANT_A);
      expect(result.id).toBe('s-1');
    });

    it('lanza 404 si no hay tenant', async () => {
      const { service } = buildService();
      await expect(service.getCurrentStore(null)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
