import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ForgotPasswordUseCase } from '../../application/use-cases/auth/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/auth/reset-password.use-case';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body('email') email: string) {
    await this.forgotPasswordUseCase.execute(email);
    return { message: 'Si el correo existe, se ha enviado un enlace de recuperación.' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body('token') token: string, @Body('newPassword') newPassword: string) {
    await this.resetPasswordUseCase.execute(token, newPassword);
    return { message: 'Contraseña actualizada correctamente.' };
  }
}
