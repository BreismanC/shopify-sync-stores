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

/**
 * Tipos de webhook que MercadoPago v3 manda relacionados con suscripciones.
 *
 * Ref: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 *
 * - `subscription_preapproval`: la suscripción fue creada o actualizada
 *   (cambios de plan, pausas, reactivaciones).
 * - `subscription_authorized_payment`: el pago pendiente de la suscripción
 *   fue aprobado (es el evento clave para avanzar al usuario al siguiente
 *   paso del onboarding).
 * - `subscription_preapproval_plan`: cambios en el plan asociado (no
 *   aplicable a suscripciones sin plan).
 */
type MpWebhookType =
  | 'subscription_preapproval'
  | 'subscription_authorized_payment'
  | 'subscription_preapproval_plan'
  | string; // MP puede sumar nuevos tipos en el futuro

/**
 * MercadoPago Webhook Controller
 *
 * Recibe notificaciones IPN de MercadoPago v3.
 *
 * NO está protegido por JwtAuthGuard — MP no envía JWT.
 * La verificación de firma usa el header `x-signature` con el formato
 * `ts=<ts>,v1=<firma>` y el header `x-request-id`. El template firmado es
 * `id:[data.id];request-id:[x-request-id];ts:[ts];` con HMAC SHA256.
 *
 * URL para configurar en el dashboard de MP:
 *   https://<tu-dominio>/api/webhooks/mercadopago
 *
 * En dev: usar cloudflared tunnel (ver wiki/specs/MERCADOPAGO_DEV_TUNNEL.md).
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
    @Body() body: { type?: MpWebhookType; data?: { id?: string } },
    @Headers('x-signature') signatureHeader?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const type = body?.type;
    const dataId = body?.data?.id;

    if (!type || !dataId) {
      throw new BadRequestException('Invalid webhook payload');
    }

    // Verificación de firma según doc oficial de MP v3.
    // Solo bloqueamos en producción; en dev dejamos pasar para que el
    // flujo se pueda probar con simulaciones locales.
    const isProduction =
      (this.configService.get<string>('NODE_ENV') ?? 'development') ===
      'production';
    if (isProduction && signatureHeader && requestId) {
      const valid = await this.webhookService.verifySignature({
        signatureHeader,
        requestId,
        dataId,
      });
      if (!valid) {
        this.logger.warn(
          `[MP Webhook] Invalid signature for type=${type} id=${dataId}`,
        );
        throw new BadRequestException('Invalid webhook signature');
      }
    } else if (!signatureHeader) {
      this.logger.warn(
        `[MP Webhook] No se recibió header x-signature. En producción MERCADOPAGO_WEBHOOK_SECRET debe estar configurado.`,
      );
    }

    this.logger.log(`[MP Webhook] type=${type} id=${dataId}`);

    switch (type) {
      case 'subscription_preapproval':
        // Creación o actualización de la suscripción. Traemos el estado
        // real desde MP para no depender del body.
        await this.handlePreapproval(dataId);
        return { received: true };

      case 'subscription_authorized_payment':
        // El pago pendiente de la suscripción fue aprobado. Esto es
        // equivalente al viejo evento `preapproval` con status=authorized.
        await this.handlePreapproval(dataId);
        return { received: true };

      case 'subscription_preapproval_plan':
        // Cambios en el plan de la suscripción. No aplica a suscripciones
        // sin plan asociado, pero MP lo manda igual; lo logueamos y
        // respondemos 200 para que no reintente.
        this.logger.log(
          `[MP Webhook] Ignoring subscription_preapproval_plan for ${dataId} (no aplica a este flujo)`,
        );
        return { received: true };

      default:
        this.logger.warn(`[MP Webhook] Unknown type: ${type}`);
        return { received: true };
    }
  }

  /**
   * Maneja eventos relacionados al estado de una suscripción:
   * `subscription_preapproval` y `subscription_authorized_payment`.
   *
   * Hace GET /preapproval/:id en MP para confirmar el estado real antes
   * de transicionar. Luego delega al servicio de webhook para actualizar
   * la subscription local y, si corresponde, avanzar al usuario.
   *
   * Si MP devuelve 400/404 al resolver el preapproval (caso típico de
   * simulaciones con IDs inventados o preapprovals creados y luego
   * borrados en MP), logueamos el detalle y devolvemos 200 igualmente
   * para no acumular reintentos de un evento que no podemos procesar.
   */
  private async handlePreapproval(preapprovalId: string): Promise<void> {
    let status: Awaited<
      ReturnType<MercadoPagoService['getPreapprovalById']>
    >;
    try {
      status = await this.mercadoPagoService.getPreapprovalById(
        preapprovalId,
      );
    } catch (err) {
      this.logger.warn(
        `[MP Webhook] No se pudo resolver el preapproval ${preapprovalId} en MP. Ack 200 para evitar reintentos.`,
      );
      return;
    }

    await this.webhookService.handlePreapprovalEvent({
      preapprovalId,
      status: status.status,
      externalReference: status.externalReference,
      nextBillingDate: status.nextBillingDate.toISOString(),
      lastBillingDate: status.lastBillingDate.toISOString(),
    });

    // `advanceUserAfterPayment` es idempotente: solo avanza si el user
    // está en PENDING_PLAN_SELECTION, así que es seguro llamarlo varias
    // veces (MP dispara múltiples eventos por suscripción).
    await this.advanceUserAfterPayment(preapprovalId);
  }

  private async advanceUserAfterPayment(
    externalSubscriptionId: string,
  ): Promise<void> {
    try {
      await this.onboardingService.advanceUserAfterPayment(
        externalSubscriptionId,
      );
    } catch (err) {
      this.logger.error(
        `[MP Webhook] Error advancing user after payment: ${err}`,
      );
    }
  }
}