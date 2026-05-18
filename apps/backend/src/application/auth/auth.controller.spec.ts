import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../../domain/entities/user.entity';
import { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    tenantId: 'tenant-1',
    role: 'user',
    password: 'hashed_password',
  } as User;

  const mockAuthService = {
    login: jest.fn().mockResolvedValue({
      access_token: 'mock-token',
      user: mockUser,
    }),
    validateUser: jest.fn(),
    register: jest.fn().mockResolvedValue(mockUser),
    validateOrCreateSocialUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return access token and user on successful login', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await controller.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(authService.validateUser).toHaveBeenCalledWith(
        'test@example.com',
        'password',
      );
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({
        access_token: 'mock-token',
        user: mockUser,
      });
    });

    it('should throw UnauthorizedException if validation fails', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(
        controller.login({ email: 'wrong@example.com', password: 'password' }),
      ).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('register', () => {
    it('should register a user and return token', async () => {
      const registerDto = {
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
        companyName: 'New Co',
      };

      await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith({
        ...registerDto,
        tenantId: expect.any(String),
      });
      expect(authService.login).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('social redirects', () => {
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockResponse = {
        redirect: jest.fn(),
      };
    });

    it('should redirect to frontend with token and user on google callback', async () => {
      mockAuthService.login.mockResolvedValue({
        access_token: 'google-token',
        user: mockUser,
      });

      await controller.googleAuthRedirect(
        { user: mockUser } as any,
        mockResponse as Response,
      );

      const expectedFrontendUrl =
        process.env.FRONTEND_URL || 'http://localhost:3000';
      const expectedUserEncoded = encodeURIComponent(JSON.stringify(mockUser));
      const expectedUrl = `${expectedFrontendUrl}/auth/callback?token=google-token&user=${expectedUserEncoded}`;

      expect(mockResponse.redirect).toHaveBeenCalledWith(expectedUrl);
    });

    it('should redirect to frontend with token and user on facebook callback', async () => {
      mockAuthService.login.mockResolvedValue({
        access_token: 'fb-token',
        user: mockUser,
      });

      await controller.facebookAuthRedirect(
        { user: mockUser } as any,
        mockResponse as Response,
      );

      const expectedFrontendUrl =
        process.env.FRONTEND_URL || 'http://localhost:3000';
      const expectedUserEncoded = encodeURIComponent(JSON.stringify(mockUser));
      const expectedUrl = `${expectedFrontendUrl}/auth/callback?token=fb-token&user=${expectedUserEncoded}`;

      expect(mockResponse.redirect).toHaveBeenCalledWith(expectedUrl);
    });
  });
});
