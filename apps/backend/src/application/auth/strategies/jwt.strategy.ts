import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../../domain/entities/user.entity';
import { IUserRepository, IUSER_REPOSITORY } from '../repositories/IUserRepository';

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
  }

  async validate(payload: { email: string }): Promise<User | null> {
    const user = await this.userRepository.findByEmail(payload.email);
    if (!user) {
      return null;
    }
    return user;
  }
}
