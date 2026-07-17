import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { OnboardingStatus } from '../../../domain/enums/onboarding-status.enum';
import {
  IUserRepository,
  IUSER_REPOSITORY,
} from '../repositories/IUserRepository';
import { TenantService } from '../../tenant/tenant.service';

export type AuthenticatedUser = User & {
  onboardingStatus: OnboardingStatus;
  isOwner: boolean;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(IUSER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly tenantService: TenantService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.AUTH_SECRET || 'super-secret-key',
    });
    console.log(
      '[JwtStrategy] AUTH_SECRET:',
      process.env.AUTH_SECRET
        ? 'exists (' + process.env.AUTH_SECRET.length + ' chars)'
        : 'MISSING - using fallback',
    );
  }

  async validate(payload: {
    email?: string | null;
    sub?: string;
    tenantId?: string;
  }): Promise<AuthenticatedUser | null> {
    console.log('[JwtStrategy] validate payload:', JSON.stringify(payload));
    const email = payload.email;
    const sub = payload.sub;
    console.log('[JwtStrategy] email:', email, 'sub:', sub);

    let user: User | null = null;

    if (email) {
      console.log('[JwtStrategy] looking up by email:', email);
      user = await this.userRepository.findByEmail(email);
    }

    if (!user && sub) {
      console.log('[JwtStrategy] looking up by id:', sub);
      user = await this.userRepository.findById(sub);
    }

    if (!user) {
      console.log('[JwtStrategy] User not found in DB');
      return null;
    }

    let onboardingStatus = OnboardingStatus.PENDING_TENANT_CONFIG;
    if (user.tenantId) {
      const tenant = await this.tenantService.findById(user.tenantId);
      onboardingStatus =
        tenant?.onboardingStatus ?? OnboardingStatus.PENDING_TENANT_CONFIG;
    }

    console.log(
      '[JwtStrategy] User found:',
      user.email,
      'id:',
      user.id,
      'tenantId:',
      user.tenantId,
      'onboardingStatus:',
      onboardingStatus,
    );

    return Object.assign(user, {
      onboardingStatus,
      isOwner: user.role === UserRole.OWNER,
    });
  }
}
