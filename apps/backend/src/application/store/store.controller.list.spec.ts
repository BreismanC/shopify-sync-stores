import { Test, TestingModule } from '@nestjs/testing';
import { StoreController } from './store.controller';
import { IStoreRepository } from './repositories/IStoreRepository';
import { StoreConnectionService } from './store-connection.service';

/**
 * Cobertura específica para `GET /api/stores` después del fix de la
 * columna `connectedAt` que no existía en `stores`.
 *
 * El bug original era: el frontend mandaba `sortBy=connectedAt` y el
 * repositorio construía `ORDER BY store.connectedAt` → error SQL
 * `no existe la columna store.connectedat`.
 *
 * Ahora hay un whitelist + alias en el DTO + un assert final en el
 * repo. Estos tests verifican que la columna real (`createdAt`)
 * llega al repo, que `connectedAt` se mapea correctamente, y que un
 * valor basura cae al default.
 */
describe('StoreController.listStores (sortBy mapping)', () => {
  let controller: StoreController;
  let storeRepository: jest.Mocked<IStoreRepository>;

  const tenantId = 'tenant-uuid';

  beforeEach(async () => {
    storeRepository = {
      findByTenantId: jest.fn(),
      findByTenantIdPaginated: jest.fn(),
      findByShopId: jest.fn(),
      findByStoreKey: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoreController],
      providers: [
        { provide: IStoreRepository, useValue: storeRepository },
        { provide: StoreConnectionService, useValue: {} as any },
      ],
    }).compile();

    controller = module.get<StoreController>(StoreController);

    storeRepository.findByTenantIdPaginated.mockResolvedValue({
      data: [],
      total: 0,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('mapea el alias "connectedAt" a la columna real "createdAt"', async () => {
    await controller.listStores(
      { user: { tenantId } } as any,
      { sortBy: 'connectedAt' } as any,
    );

    expect(storeRepository.findByTenantIdPaginated).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ sortBy: 'createdAt', order: 'desc' }),
    );
  });

  it('respeta sortBy="createdAt" (columna real)', async () => {
    await controller.listStores(
      { user: { tenantId } } as any,
      { sortBy: 'createdAt' } as any,
    );

    expect(storeRepository.findByTenantIdPaginated).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ sortBy: 'createdAt' }),
    );
  });

  it('respeta sortBy="shopifyShopId"', async () => {
    await controller.listStores(
      { user: { tenantId } } as any,
      { sortBy: 'shopifyShopId' } as any,
    );

    expect(storeRepository.findByTenantIdPaginated).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ sortBy: 'shopifyShopId' }),
    );
  });

  it('descarta un sortBy inválido y cae al default "createdAt"', async () => {
    await controller.listStores(
      { user: { tenantId } } as any,
      { sortBy: 'banana' } as any,
    );

    expect(storeRepository.findByTenantIdPaginated).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ sortBy: 'createdAt' }),
    );
  });

  it('lanza NotFoundException si el usuario no tiene tenantId', async () => {
    let caught: any;
    try {
      await controller.listStores(
        { user: { tenantId: undefined } } as any,
        {} as any,
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(storeRepository.findByTenantIdPaginated).not.toHaveBeenCalled();
  });
});
