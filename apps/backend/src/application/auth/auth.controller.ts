import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Get,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { RegisterDto } from './dtos/register.dto';
import { User } from '../../domain/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
