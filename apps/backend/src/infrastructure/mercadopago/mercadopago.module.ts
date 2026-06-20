import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MercadoPagoService } from './mercadopago.service';
import { MercadoPagoWebhookService } from './mercadopago-webhook.service';
import { MercadoPagoWebhookController } from './mercadopago-webhook.controller';
import { SubscriptionModule } from '../../application/subscription/subscription.module';
import { OnboardingModule } from '../../application/onboarding/onboarding.module';

/**
 * MercadoPago Module
 *
 * Integración con MercadoPago REST API para suscripciones recurrentes.
 *
 * Variables de entorno necesarias:
 * - MERCADOPAGO_ACCESS_TOKEN: Token de acceso a la API de MP
 * - MERCADOPAGO_PUBLIC_KEY: Clave pública para SDK frontend
 * - MERCADOPAGO_SANDBOX: 'true' para sandbox, 'false' para producción
 * - MERCADOPAGO_WEBHOOK_SECRET: Secret para verificar firmas de webhooks
 */
@Module({
  imports: [ConfigModule, SubscriptionModule, forwardRef(() => OnboardingModule)],
  controllers: [MercadoPagoWebhookController],
  providers: [MercadoPagoService, MercadoPagoWebhookService],
  exports: [MercadoPagoService, MercadoPagoWebhookService],
})
export class MercadoPagoModule {}
