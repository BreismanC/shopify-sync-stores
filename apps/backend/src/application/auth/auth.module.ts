import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { User } from '../../domain/entities/user.entity';
import { EmailService } from '../../infrastructure/services/email/resend.service';
import { ForgotPasswordUseCase } from '../use-cases/auth/forgot-password.use-case';
import { ResetPasswordUseCase } from '../use-cases/auth/reset-password.use-case';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { TypeORMUserRepository } from '../../infrastructure/repositories/TypeORMUserRepository';
import { AuthController } from './auth.controller';
import { IUSER_REPOSITORY } from './repositories/IUserRepository';
import { TenantModule } from '../tenant/tenant.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('AUTH_SECRET') || 'super-secret-key',
        signOptions: { expiresIn: '1d' },
      }),
    }),
    TenantModule,
    SubscriptionModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    FacebookStrategy,
    {
      provide: IUSER_REPOSITORY,
      useClass: TypeORMUserRepository,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
