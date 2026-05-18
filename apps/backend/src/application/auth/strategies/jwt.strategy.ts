import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../../domain/entities/user.entity';
import { IUserRepository } from '../repositories/IUserRepository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userRepository: IUserRepository) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.AUTH_SECRET as string, // Cast to string
    });
  }

  async validate(payload: { sub: string }): Promise<User | null> {
    // Type payload properly
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      return null;
    }
    return user;
  }
}
