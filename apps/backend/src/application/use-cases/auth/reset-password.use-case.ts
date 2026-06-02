import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { IUSER_REPOSITORY } from '../../auth/repositories/IUserRepository';
import { type IUserRepository } from '../../../application/auth/repositories/IUserRepository';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private jwtService: JwtService,
    @Inject(IUSER_REPOSITORY)
    private userRepository: IUserRepository,
  ) {}

  async execute(token: string, newPassword: string) {
    try {
      const payload = this.jwtService.verify(token);
      console.log("newPassword received:", newPassword);
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.userRepository.updatePassword(payload.email, hashedPassword);
    } catch (e) {
      console.log("error en payload",e);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
