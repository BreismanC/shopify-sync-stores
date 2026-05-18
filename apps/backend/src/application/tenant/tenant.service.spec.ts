import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './tenant.service';
import { ITenantRepository } from '../repositories/ITenantRepository';

describe('TenantService', () => {
  let tenantService: TenantService;
  let tenantRepository: jest.Mocked<ITenantRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: ITenantRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findById: jest.fn(),
            findByName: jest.fn(),
          },
        },
      ],
    }).compile();

    tenantService = module.get<TenantService>(TenantService);
    tenantRepository = module.get(ITenantRepository);
  });

  it('should create a tenant', async () => {
    const tenantData = { name: 'Test Tenant' };
    const mockTenant = {
      id: 'tenant-uuid',
      name: 'Test Tenant',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tenantRepository.create.mockResolvedValue(mockTenant as any);

    const result = await tenantService.create(tenantData);

    expect(tenantRepository.create).toHaveBeenCalledWith(tenantData);
    expect(result).toEqual(mockTenant);
  });

  it('should find a tenant by id', async () => {
    const tenantId = 'tenant-uuid';
    const mockTenant = {
      id: tenantId,
      name: 'Test Tenant',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tenantRepository.findById.mockResolvedValue(mockTenant as any);

    const result = await tenantService.findById(tenantId);

    expect(tenantRepository.findById).toHaveBeenCalledWith(tenantId);
    expect(result).toEqual(mockTenant);
  });

  it('should find a tenant by name', async () => {
    const name = 'Test Tenant';
    const mockTenant = {
      id: 'tenant-uuid',
      name,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tenantRepository.findByName.mockResolvedValue(mockTenant as any);

    const result = await tenantService.findByName(name);

    expect(tenantRepository.findByName).toHaveBeenCalledWith(name);
    expect(result).toEqual(mockTenant);
  });
});
