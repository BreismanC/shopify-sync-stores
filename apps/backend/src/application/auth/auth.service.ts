import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IUSER_REPOSITORY, type IUserRepository } from './repositories/IUserRepository';
import * as bcrypt from 'bcrypt';
import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/enums/user-role.enum';
import { OnboardingStatus } from '../../domain/enums/onboarding-status.enum';
import { TenantService } from '../tenant/tenant.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(IUSER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly tenantService: TenantService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      return user;
    }
    return null;
  }

  async login(user: User): Promise<{
    access_token: string;
    user: {
      id: string;
      email: string;
      name: string;
      tenantId: string | null;
      role: string;
    };
  }> {
    console.log('Logging in user:', user);
    const payload = {
      email: user.email,
      sub: user.id,
      tenantId: user.tenantId,
    };
    return Promise.resolve({
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
      },
    });
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
    companyName?: string;
  }): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('El correo electrónico ya está en uso'); // Using Error for easier testing if UnauthorizedException is hard to mock
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 1. Crear el Tenant
    const tenant = await this.tenantService.create(
      data.companyName || data.name,
    );

    // 2. Crear la suscripción de prueba
    await this.subscriptionService.createTrial(tenant.id);

    // 3. Crear el Usuario vinculado al nuevo Tenant
    const user = this.userRepository.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      companyName: data.companyName,
      tenantId: tenant.id,
      role: UserRole.MEMBER,
      onboardingStatus: OnboardingStatus.PENDING_STORE_CONFIG,
    });

    return this.userRepository.save(user);
  }

  async validateOrCreateSocialUser(data: {
    email: string;
    name: string;
  }): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      return existingUser;
    }

    // Si no existe, crear un nuevo Tenant
    const tenant = await this.tenantService.create(data.name);

    const user = this.userRepository.create({
      email: data.email,
      name: data.name,
      tenantId: tenant.id,
      role: UserRole.MEMBER,
    });

    return this.userRepository.save(user);
  }
}
