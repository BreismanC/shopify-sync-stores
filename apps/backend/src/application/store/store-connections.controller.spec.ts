import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StoreController } from './store.controller';
import { IStoreRepository } from './repositories/IStoreRepository';
import { StoreConnectionService } from './store-connection.service';
import { UserRole } from '../../domain/enums/user-role.enum';
import { StoreRole } from '../../domain/enums/store-role.enum';

describe('StoreController (connections endpoints)', () => {
  let controller: StoreController;
  let storeRepository: jest.Mocked<IStoreRepository>;
  let connectionService: jest.Mocked<StoreConnectionService>;

  beforeEach(async () => {
    storeRepository = {
      findByTenantId: jest.fn(),
      findByStoreKey: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      findByShopId: jest.fn(),
    } as any;

    connectionService = {
      getCurrentStore: jest.fn(),
      listConnections: jest.fn(),
      connectByStoreKey: jest.fn(),
      sendStoreKeyByEmail: jest.fn(),
      disconnect: jest.fn(),
      hasActiveConnection: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoreController],
      providers: [
        { provide: IStoreRepository, useValue: storeRepository },
        { provide: StoreConnectionService, useValue: connectionService },
      ],
    }).compile();

    controller = module.get<StoreController>(StoreController);
  });

  it('POST /connections normaliza la key antes de pasar al service', async () => {
    connectionService.connectByStoreKey.mockResolvedValue({
      connection: {
        id: 'c1',
        sourceStoreId: 's1',
        vendorStoreId: 's2',
        isActive: true,
        connectedAt: new Date(),
        disconnectedAt: null,
      },
      store: {
        id: 's2',
        shopifyShopId: 'x.myshopify.com',
        role: StoreRole.VENDOR,
        storeKey: 'ABC',
        isActive: true,
        tenantId: 't2',
      },
    });

    await controller.connect(
      { user: { id: 'u1', role: UserRole.OWNER, tenantId: 't1' } } as any,
      { storeKey: ' abc ' },
    );

    expect(connectionService.connectByStoreKey).toHaveBeenCalledWith(
      expect.anything(),
      ' abc ',
    );
  });

  it('POST /connections/email propaga email al service', async () => {
    connectionService.sendStoreKeyByEmail.mockResolvedValue({
      message: 'ok',
    });
    await controller.sendKey(
      { user: { id: 'u1', role: UserRole.OWNER, tenantId: 't1' } } as any,
      { email: 'a@a.com' },
    );
    expect(connectionService.sendStoreKeyByEmail).toHaveBeenCalledWith(
      expect.anything(),
      'a@a.com',
    );
  });

  it('DELETE /connections/:id propaga connectionId al service', async () => {
    connectionService.disconnect.mockResolvedValue({
      connection: {
        id: 'c1',
        sourceStoreId: 's1',
        vendorStoreId: 's2',
        isActive: false,
        connectedAt: new Date(),
        disconnectedAt: new Date(),
      },
    });
    await controller.disconnect(
      { user: { id: 'u1', role: UserRole.OWNER, tenantId: 't1' } } as any,
      'c1',
    );
    expect(connectionService.disconnect).toHaveBeenCalledWith(
      expect.anything(),
      'c1',
    );
  });

  it('GET /connections propaga options paginadas', async () => {
    connectionService.listConnections.mockResolvedValue({
      data: [],
      pagination: {
        total: 0,
        page: 1,
        perPage: 10,
        lastPage: 1,
        totalPages: 1,
      },
    });
    await controller.listConnections(
      { user: { id: 'u1', role: UserRole.OWNER, tenantId: 't1' } } as any,
      { page: 2, perPage: 5 } as any,
    );
    expect(connectionService.listConnections).toHaveBeenCalledWith('t1', {
      search: undefined,
      page: 2,
      perPage: 5,
      sortBy: 'connectedAt',
      order: 'desc',
    });
  });
});
