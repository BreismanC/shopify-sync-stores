import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../../domain/entities/user.entity';
import {
  IUserRepository,
  IUSER_REPOSITORY,
} from '../repositories/IUserRepository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(IUSER_REPOSITORY)
    private readonly userRepository: IUserRepository,
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
  }): Promise<User | null> {
    console.log('[JwtStrategy] validate payload:', JSON.stringify(payload));
    const email = payload.email;
    const sub = payload.sub;
    console.log('[JwtStrategy] email:', email, 'sub:', sub);

    let user: User | null = null;

    // Try by email first
    if (email) {
      console.log('[JwtStrategy] looking up by email:', email);
      user = await this.userRepository.findByEmail(email);
    }

    // Try by user ID (sub)
    if (!user && sub) {
      console.log('[JwtStrategy] looking up by id:', sub);
      user = await this.userRepository.findById(sub);
    }

    if (!user) {
      console.log('[JwtStrategy] User not found in DB');
      return null;
    }
    console.log(
      '[JwtStrategy] User found:',
      user.email,
      'id:',
      user.id,
      'tenantId:',
      user.tenantId,
    );
    return user;
  }
}
