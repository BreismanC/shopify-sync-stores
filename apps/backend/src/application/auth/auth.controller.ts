import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Get,
  UseGuards,
  Req,
  Res,
  Put,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ForgotPasswordUseCase } from '../use-cases/auth/forgot-password.use-case';
import { ResetPasswordUseCase } from '../use-cases/auth/reset-password.use-case';
import { AuthGuard } from '@nestjs/passport';
import { RegisterDto } from './dtos/register.dto';
import { User } from '../../domain/entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface RequestWithUser extends Request { user: { id: string } }

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: RequestWithUser) {
    try { return this.authService.getProfile(req.user.id); }
    catch { throw new NotFoundException('Usuario no encontrado'); }
  }

  @Put('me/profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: RequestWithUser, @Body() body: { name?: string; email?: string }) {
    if (!body.name?.trim() || !body.email?.trim() || !body.email.includes('@')) throw new BadRequestException('Nombre y correo electrónico son obligatorios');
    try { return await this.authService.updateProfile(req.user.id, { name: body.name, email: body.email }); }
    catch (error) { if (error instanceof Error && error.message.includes('correo')) throw new ConflictException(error.message); throw new NotFoundException('Usuario no encontrado'); }
  }

  @Put('me/password')
  @UseGuards(JwtAuthGuard)
  async updatePassword(@Req() req: RequestWithUser, @Body() body: { password?: string; confirmPassword?: string }) {
    if (!body.password || body.password.length < 6 || body.password !== body.confirmPassword) throw new BadRequestException('La contraseña debe tener al menos 6 caracteres y coincidir con la confirmación');
    try { await this.authService.updatePassword(req.user.id, body.password); return { message: 'Contraseña actualizada correctamente' }; }
    catch { throw new NotFoundException('Usuario no encontrado'); }
  }

  @Post('login')
  async login(@Body() loginDto: { email: string; password: string }) {
    const { email, password } = loginDto;
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    return this.authService.login(user);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: { user: User }, @Res() res: Response) {
    const authData = await this.authService.login(req.user);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const token = authData.access_token;
    const user = JSON.stringify(authData.user);
    const encodedUser = encodeURIComponent(user);

    return res.redirect(
      `${frontendUrl}/auth/callback?token=${token}&user=${encodedUser}`,
    );
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth() {}

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthRedirect(@Req() req: { user: User }, @Res() res: Response) {
    console.log('Facebook callback reached, req.user:', req.user);
    const authData = await this.authService.login(req.user);
    console.log('Auth data generated:', authData);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const token = authData.access_token;
    const user = JSON.stringify(authData.user);
    const encodedUser = encodeURIComponent(user);

    return res.redirect(
      `${frontendUrl}/auth/callback?token=${token}&user=${encodedUser}`,
    );
  }

  @Post('forgot-password')
  @Throttle({ short: { limit: 1, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body('email') email: string) {
    await this.forgotPasswordUseCase.execute(email);
    return {
      message: 'Si el correo existe, se ha enviado un enlace de recuperación.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.resetPasswordUseCase.execute(token, newPassword);
    return { message: 'Contraseña actualizada correctamente.' };
  }
}
