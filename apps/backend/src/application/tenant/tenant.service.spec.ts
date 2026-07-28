import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './tenant.service';
import { ITenantRepository } from './repositories/ITenantRepository';
import { IUSER_REPOSITORY } from '../auth/repositories/IUserRepository';

describe('TenantService', () => {
  let tenantService: TenantService;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let userRepository: jest.Mocked<any>;

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
        {
          provide: IUSER_REPOSITORY,
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
      ],
    }).compile();

    tenantService = module.get<TenantService>(TenantService);
    tenantRepository = module.get(ITenantRepository);
    userRepository = module.get(IUSER_REPOSITORY);
  });

  it('should create a tenant', async () => {
    const tenantName = 'Test Tenant';
    const mockTenant = {
      id: 'tenant-uuid',
      name: tenantName,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tenantRepository.create.mockReturnValue(mockTenant as any);
    tenantRepository.save.mockResolvedValue(mockTenant as any);

    const result = await tenantService.create(tenantName);

    expect(tenantRepository.create).toHaveBeenCalledWith({ name: tenantName });
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

  describe('upsertTenant', () => {
    it('should create a new tenant and link it to the user when user has no tenant', async () => {
      const userId = 'user-uuid';
      const tenantName = 'New Tenant';
      const mockUser = { id: userId, tenantId: null };
      const mockTenant = {
        id: 'tenant-uuid',
        name: tenantName,
        status: 'ACTIVE',
      };

      userRepository.findById.mockResolvedValue(mockUser as any);
      tenantRepository.create.mockReturnValue(mockTenant as any);
      tenantRepository.save.mockResolvedValue(mockTenant as any);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        tenantId: 'tenant-uuid',
      } as any);

      const result = await tenantService.upsertTenant(userId, tenantName);

      expect(tenantRepository.create).toHaveBeenCalledWith({
        name: tenantName,
      });
      expect(tenantRepository.save).toHaveBeenCalledWith(mockTenant);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-uuid' }),
      );
      expect(result).toEqual(mockTenant);
    });

    it('should update the existing tenant name when user already has a tenant', async () => {
      const userId = 'user-uuid';
      const existingTenantId = 'existing-tenant-uuid';
      const newName = 'Updated Tenant';
      const mockUser = { id: userId, tenantId: existingTenantId };
      const existingTenant = {
        id: existingTenantId,
        name: 'Old Name',
        status: 'ACTIVE',
      };

      userRepository.findById.mockResolvedValue(mockUser as any);
      tenantRepository.findById.mockResolvedValue(existingTenant as any);
      tenantRepository.save.mockResolvedValue({
        ...existingTenant,
        name: newName,
      } as any);

      const result = await tenantService.upsertTenant(userId, newName);

      expect(tenantRepository.findById).toHaveBeenCalledWith(existingTenantId);
      expect(tenantRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: newName }),
      );
      expect(result.name).toBe(newName);
    });

    it('should throw if the user is not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        tenantService.upsertTenant('non-existent', 'Name'),
      ).rejects.toThrow('Usuario no encontrado');
    });
  });
});
