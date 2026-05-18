import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { IUserRepository } from './repositories/IUserRepository';
import { TenantService } from '../../tenant/tenant.service';
import { SubscriptionService } from '../../subscription/subscription.service';
import { JwtService } from '@nestjs/jwt';
import { OnboardingStatus } from '../../domain/enums/onboarding-status.enum';
import { UserRole } from '../../domain/enums/user-role.enum';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: jest.Mocked<IUserRepository>;
  let tenantService: jest.Mocked<TenantService>;
  let subscriptionService: jest.Mocked<SubscriptionService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: IUserRepository,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: TenantService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: SubscriptionService,
          useValue: {
            createTrial: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get(IUserRepository);
    tenantService = module.get(TenantService);
    subscriptionService = module.get(SubscriptionService);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('should successfully register a new user, creating a tenant and a trial subscription', async () => {
      const registerData = {
        name: 'Test User',
        email: 'test@example.com',
        password: '***',
        companyName: 'Test Company',
      };

      const mockTenant = { id: 'tenant-uuid', name: 'Test Company' };
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        name: 'Test User',
        tenantId: 'tenant-uuid',
        role: UserRole.MEMBER,
        onboardingStatus: OnboardingStatus.PENDING_STORE_CONFIG,
      };

      userRepository.findByEmail.mockResolvedValue(null);
      tenantService.create.mockResolvedValue(mockTenant as any);
      subscriptionService.createTrial.mockResolvedValue({
        id: 'sub-uuid',
      } as any);
      userRepository.create.mockReturnValue(mockUser as any);
      userRepository.save.mockResolvedValue(mockUser as any);

      const result = await authService.register(registerData);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        registerData.email,
      );
      expect(tenantService.create).toHaveBeenCalledWith(
        registerData.companyName,
      );
      expect(subscriptionService.createTrial).toHaveBeenCalledWith(
        mockTenant.id,
      );
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenant.id,
          onboardingStatus: OnboardingStatus.PENDING_STORE_CONFIG,
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw an error if the email is already in use', async () => {
      const registerData = {
        name: 'Test User',
        email: 'existing@example.com',
        password: '***',
      };

      userRepository.findByEmail.mockResolvedValue({
        email: 'existing@example.com',
      } as any);

      await expect(authService.register(registerData)).rejects.toThrow(
        'El correo electrónico ya está en uso',
      );
    });
  });
});
