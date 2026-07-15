import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Payment, Preference, PreApproval, PreApprovalPlan } from 'mercadopago';
import {
  MercadoPagoService,
  MERCADOPAGO_PAYMENT_CLIENT,
  MERCADOPAGO_PREFERENCE_CLIENT,
  MERCADOPAGO_PRE_APPROVAL_CLIENT,
  MERCADOPAGO_PRE_APPROVAL_PLAN_CLIENT,
  buildMercadoPagoConfig,
} from './mercadopago.service';
import { MercadoPagoTokenService } from './mercadopago-token.service';
import { MercadoPagoWebhookService } from './mercadopago-webhook.service';
import { MercadoPagoWebhookController } from './mercadopago-webhook.controller';
import { SubscriptionModule } from '../../application/subscription/subscription.module';
import { OnboardingModule } from '../../application/onboarding/onboarding.module';

/**
 * MercadoPago Module
 *
 * Integración con MercadoPago vía SDK oficial `mercadopago` v3+ (Node.js).
 * Cada cliente del SDK (Preference, PreApproval, PreApprovalPlan, Payment)
 * se inyecta como provider para mantener `MercadoPagoService` testeable con
 * mocks simples en Jest (no se mockea `global.fetch` ni `node_modules`).
 *
 * Variables de entorno necesarias:
 * - MERCADOPAGO_ACCESS_TOKEN: Token de acceso a la API de MP
 *   (TEST-... para sandbox, APP_USR-... para producción)
 * - MERCADOPAGO_PUBLIC_KEY: Clave pública para SDK frontend
 * - MERCADOPAGO_SANDBOX: 'true' para sandbox, 'false' para producción
 * - MERCADOPAGO_WEBHOOK_SECRET: Secret para verificar firmas de webhooks
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('MERCADOPAGO_STATUS_TOKEN_SECRET') ??
          configService.get<string>('AUTH_SECRET') ??
          'super-secret-key',
        signOptions: { expiresIn: '30m' },
      }),
    }),
    SubscriptionModule,
    forwardRef(() => OnboardingModule),
  ],
  controllers: [MercadoPagoWebhookController],
  providers: [
    {
      provide: MERCADOPAGO_PREFERENCE_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Preference(buildMercadoPagoConfig(configService)),
    },
    {
      provide: MERCADOPAGO_PRE_APPROVAL_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new PreApproval(buildMercadoPagoConfig(configService)),
    },
    {
      provide: MERCADOPAGO_PRE_APPROVAL_PLAN_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new PreApprovalPlan(buildMercadoPagoConfig(configService)),
    },
    {
      provide: MERCADOPAGO_PAYMENT_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Payment(buildMercadoPagoConfig(configService)),
    },
    MercadoPagoService,
    MercadoPagoTokenService,
    MercadoPagoWebhookService,
  ],
  exports: [
    MercadoPagoService,
    MercadoPagoTokenService,
    MercadoPagoWebhookService,
    MERCADOPAGO_PREFERENCE_CLIENT,
    MERCADOPAGO_PRE_APPROVAL_CLIENT,
    MERCADOPAGO_PRE_APPROVAL_PLAN_CLIENT,
    MERCADOPAGO_PAYMENT_CLIENT,
  ],
})
export class MercadoPagoModule {}
