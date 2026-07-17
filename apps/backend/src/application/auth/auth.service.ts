import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  IUSER_REPOSITORY,
  type IUserRepository,
} from './repositories/IUserRepository';
import * as bcrypt from 'bcrypt';
import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/enums/user-role.enum';
import { OnboardingStatus } from '../../domain/enums/onboarding-status.enum';
import { TenantService } from '../tenant/tenant.service';
import { SubscriptionService } from '../subscription/subscription.service';

export type AuthUserPayload = {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
  role: string;
  isOwner: boolean;
  onboardingStatus: OnboardingStatus;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(IUSER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly tenantService: TenantService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    console.log('[AuthService] AUTH_SECRET exists:', !!process.env.AUTH_SECRET);
    console.log(
      '[AuthService] JWT_SIGN_SECRET exists:',
      !!process.env.JWT_SIGN_SECRET,
    );
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      return user;
    }
    return null;
  }

  private async resolveOnboardingStatus(
    user: User,
  ): Promise<OnboardingStatus> {
    if (!user.tenantId) {
      return OnboardingStatus.PENDING_TENANT_CONFIG;
    }
    const tenant = await this.tenantService.findById(user.tenantId);
    return (
      tenant?.onboardingStatus ?? OnboardingStatus.PENDING_TENANT_CONFIG
    );
  }

  private toAuthUser(
    user: User,
    onboardingStatus: OnboardingStatus,
  ): AuthUserPayload {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      role: user.role,
      isOwner: user.role === UserRole.OWNER,
      onboardingStatus,
    };
  }

  async login(user: User): Promise<{
    access_token: string;
    user: AuthUserPayload;
  }> {
    console.log('Logging in user:', user);
    const onboardingStatus = await this.resolveOnboardingStatus(user);
    const authUser = this.toAuthUser(user, onboardingStatus);
    const payload = {
      email: user.email,
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      isOwner: authUser.isOwner,
      onboardingStatus,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: authUser,
    };
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
    companyName: string;
  }): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('El correo electrónico ya está en uso');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 1. Crear el Tenant con el nombre de empresa enviado en el formulario.
    const tenant = await this.tenantService.create(data.companyName.trim());

    // 2. Crear la suscripción de prueba
    await this.subscriptionService.createTrial(tenant.id);

    // 3. Crear el Usuario OWNER vinculado al nuevo Tenant
    const user = this.userRepository.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      tenantId: tenant.id,
      role: UserRole.OWNER,
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

    const user = this.userRepository.create({
      email: data.email,
      name: data.name,
      tenantId: undefined,
      role: UserRole.OWNER,
    });

    return this.userRepository.save(user);
  }
}
