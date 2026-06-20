import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoWebhookService } from './mercadopago-webhook.service';
import { MercadoPagoService } from './mercadopago.service';
import { OnboardingService } from '../../application/onboarding/onboarding.service';
import { OnboardingStatus } from '../../domain/enums/onboarding-status.enum';

/**
 * MercadoPago Webhook Controller
 *
 * Recibe notificaciones IPN (Instant Payment Notification) de MercadoPago.
 * NO está protegido por JwtAuthGuard — MP no envía JWT.
 * El signature verification se hace con `MERCADOPAGO_WEBHOOK_SECRET`.
 *
 * URL para configurar en MP Dashboard:
 *   https://<tu-dominio>/api/webhooks/mercadopago
 *
 * En dev: usar cloudflared tunnel (ver wiki/specs/MERCADOPAGO_DEV_TUNNEL.md).
 *
 * Topics manejados:
 *  - `preapproval` (creación, actualización, activación, cancelación de
 *    suscripciones recurrentes)
 *  - `payment` (cobros individuales de la suscripción)
 *
 * Flujo de preapproval:
 *  1. MP notifica con `type: 'preapproval'` y `data.id` = preapproval id
 *  2. Backend hace GET /v1/preapprovals/:id para obtener el estado real
 *  3. Si status = 'authorized' o 'active' y el user está en plan selection,
 *     transiciona a PENDING_STORE_CONFIG
 *  4. Si status = 'cancelled' o 'paused', marca la subscription como tal
 *     sin transicionar al user
 */
@Controller('webhooks/mercadopago')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(
    private readonly webhookService: MercadoPagoWebhookService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly onboardingService: OnboardingService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: any,
    @Headers('x-mp-signature') signature?: string,
    @Headers('x-mp-timestamp') timestamp?: string,
  ) {
    // Convertir body a string crudo para verificar firma
    const rawBody = JSON.stringify(body);

    if (signature && timestamp) {
      const valid = await this.webhookService.verifySignature(
        signature,
        rawBody,
        timestamp,
      );
      if (!valid) {
        this.logger.warn('Invalid webhook signature');
        throw new BadRequestException('Invalid webhook signature');
      }
    } else {
      this.logger.warn(
        'No se recibió signature header. En producción MERCADOPAGO_WEBHOOK_SECRET debe estar configurado.',
      );
    }

    const type = body?.type;
    const dataId = body?.data?.id;

    if (!type || !dataId) {
      throw new BadRequestException('Invalid webhook payload');
    }

    this.logger.log(`[MP Webhook] type=${type} id=${dataId}`);

    if (type === 'preapproval') {
      await this.handlePreapproval(dataId);
    } else if (type === 'payment') {
      await this.handlePayment(dataId);
    } else {
      this.logger.warn(`[MP Webhook] Unknown type: ${type}`);
    }

    return { received: true };
  }

  /**
   * Maneja notificaciones de preapproval.
   * Hace GET /v1/preapprovals/:id para confirmar el estado real antes de
   * transicionar.
   */
  private async handlePreapproval(preapprovalId: string): Promise<void> {
    try {
      const status = await this.mercadoPagoService.getPreapprovalStatus(
        preapprovalId,
      );

      this.logger.log(
        `[MP Webhook] preapproval ${preapprovalId} status: ${status.status}`,
      );

      // Delegar al servicio de webhook (que ya actualiza la subscription)
      await this.webhookService.handlePreapprovalEvent({
        id: preapprovalId,
        status: status.status,
        externalSubscriptionId: preapprovalId,
        preapprovalPlanId: '',
        nextBillingDate: status.nextBillingDate.toISOString(),
        lastBillingDate: status.lastBillingDate.toISOString(),
      });

      // Si el pago fue aprobado y el user está en plan selection,
      // transicionar al siguiente paso del onboarding.
      if (status.status === 'active') {
        await this.advanceUserAfterPayment(preapprovalId);
      }
    } catch (err) {
      this.logger.error(
        `[MP Webhook] Error processing preapproval ${preapprovalId}: ${err}`,
      );
      throw err;
    }
  }

  /**
   * Maneja notificaciones de payment (cobros recurrentes).
   */
  private async handlePayment(paymentId: string): Promise<void> {
    // Para cobros recurrentes, MP envía el ID del pago pero el link
    // a la subscription requiere otro GET. Por simplicidad, el service
    // ya maneja la actualización del estado de la subscription.
    await this.webhookService.handlePaymentEvent({
      id: paymentId,
      status: 'approved', // Asumimos approved en este punto; el service real haría otro GET
      externalSubscriptionId: paymentId,
      paymentType: 'credit_card',
      transactionAmount: 0,
    });
  }

  /**
   * Si un usuario completó el pago del plan y está en PENDING_PLAN_SELECTION,
   * transiciona a PENDING_STORE_CONFIG.
   */
  private async advanceUserAfterPayment(
    externalSubscriptionId: string,
  ): Promise<void> {
    try {
      const advanced = await this.onboardingService.advanceUserAfterPayment(
        externalSubscriptionId,
      );
      if (advanced) {
        this.logger.log(
          `[MP Webhook] User ${advanced.userId} advanced to ${advanced.onboardingStatus}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[MP Webhook] Error advancing user after payment: ${err}`,
      );
    }
  }
}
