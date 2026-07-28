import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import {
  IUSER_REPOSITORY,
  IUserRepository,
} from './repositories/IUserRepository';
import { TenantService } from '../tenant/tenant.service';
import { SubscriptionService } from '../subscription/subscription.service';
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
    userRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;
    tenantService = {
      create: jest.fn(),
      findById: jest.fn(),
    } as any;
    subscriptionService = {
      createTrial: jest.fn(),
    } as any;
    jwtService = {
      sign: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: IUSER_REPOSITORY,
          useValue: userRepository,
        },
        {
          provide: TenantService,
          useValue: tenantService,
        },
        {
          provide: SubscriptionService,
          useValue: subscriptionService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should successfully register a new OWNER user with tenant and trial', async () => {
      const registerData = {
        name: 'Test User',
        email: 'test@example.com',
        companyName: 'Acme Inc',
        password: '***',
      };

      const mockTenant = { id: 'tenant-uuid', name: 'Acme Inc' };
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        name: 'Test User',
        tenantId: 'tenant-uuid',
        role: UserRole.OWNER,
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
          role: UserRole.OWNER,
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw an error if the email is already in use', async () => {
      const registerData = {
        name: 'Test User',
        email: 'existing@example.com',
        companyName: 'Existing Inc',
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

  describe('validateOrCreateSocialUser', () => {
    it('should return the existing user if already exists', async () => {
      const userData = { email: 'test@example.com', name: 'Test User' };
      const mockUser = { id: 'user-uuid', ...userData };

      userRepository.findByEmail.mockResolvedValue(mockUser as any);

      const result = await authService.validateOrCreateSocialUser(userData);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(result).toEqual(mockUser);
    });

    it('should create a new OWNER without tenant if user does not exist', async () => {
      const userData = { email: 'new@example.com', name: 'New User' };
      const mockUser = {
        id: 'user-uuid',
        ...userData,
        tenantId: null,
        role: UserRole.OWNER,
      };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser as any);
      userRepository.save.mockResolvedValue(mockUser as any);

      const result = await authService.validateOrCreateSocialUser(userData);

      expect(tenantService.create).not.toHaveBeenCalled();
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: undefined,
          role: UserRole.OWNER,
        }),
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('login', () => {
    it('should include tenant onboardingStatus and isOwner in the response', async () => {
      const mockUser: any = {
        id: 'user-uuid',
        email: 'test@example.com',
        name: 'Test User',
        tenantId: 'tenant-uuid',
        role: UserRole.OWNER,
      };

      tenantService.findById.mockResolvedValue({
        id: 'tenant-uuid',
        onboardingStatus: OnboardingStatus.PENDING_STORE_ROLE,
      } as any);
      jwtService.sign.mockReturnValue('signed-jwt');

      const result = await authService.login(mockUser);

      expect(tenantService.findById).toHaveBeenCalledWith('tenant-uuid');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockUser.email,
          sub: mockUser.id,
          tenantId: mockUser.tenantId,
          isOwner: true,
          onboardingStatus: OnboardingStatus.PENDING_STORE_ROLE,
        }),
      );
      expect(result.user).toEqual(
        expect.objectContaining({
          isOwner: true,
          onboardingStatus: OnboardingStatus.PENDING_STORE_ROLE,
        }),
      );
    });
  });
});
