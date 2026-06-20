import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { Subscription } from '../../domain/entities/subscription.entity';
import { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';
import { ISubscriptionRepository } from '../../application/subscription/repositories/ISubscriptionRepository';

/**
 * MercadoPago Webhook Service
 *
 * Procesa las notificaciones IPN (Instant Payment Notification) de MercadoPago.
 *
 * Verificación de firma SHA256:
 * MP firma las notificaciones con el secret de webhook.
 * La firma se verifica comparando el SHA256 del body + timestamp con el header x-mp-signature.
 */
@Injectable()
export class MercadoPagoWebhookService {
  private readonly webhookSecret: string;

  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret =
      this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET') ?? '';
  }

  /**
   * Verifica la firma SHA256 del webhook de MercadoPago
   *
   * Headers necesarios:
   * - x-mp-signature: firma SHA256
   * - x-mp-timestamp: timestamp de la solicitud
   *
   * @param signature - Firma del header x-mp-signature
   * @param body - Raw body string para verificar
   * @param timestamp - Timestamp del header x-mp-timestamp
   */
  async verifySignature(
    signature: string,
    body: string,
    timestamp: string,
  ): Promise<boolean> {
    if (!this.webhookSecret) {
      console.warn(
        '[MercadoPagoWebhook] Webhook secret no configurado, omitiendo verificación',
      );
      return true; // En desarrollo sin secret, aceptamos todo
    }

    // El mensaje que se firma es: timestamp + body
    const message = `${timestamp}${body}`;

    // Generar HMAC SHA256 del mensaje
    const expectedSignature = createHmac('sha256', this.webhookSecret)
      .update(message)
      .digest('hex');

    // Comparar firmas en tiempo constante para evitar timing attacks
    return this.secureCompare(signature, expectedSignature);
  }

  /**
   * Comparación segura de strings (tiempo constante)
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Procesa evento de preapproval (suscripción)
   *
   * Topics: preapproval
   * Actions: created, activated, updated, cancelled, overdue
   */
  async handlePreapprovalEvent(data: {
    id: string;
    status: 'pending' | 'active' | 'cancelled' | 'paused' | 'expired';
    externalSubscriptionId: string;
    preapprovalPlanId: string;
    nextBillingDate: string;
    lastBillingDate: string;
  }): Promise<void> {
    console.log(
      `[MercadoPagoWebhook] Preapproval event: ${data.id} - ${data.status}`,
    );

    // Encontrar la suscripción por externalSubscriptionId
    const subscription =
      await this.subscriptionRepository.findByExternalSubscriptionId(
        data.externalSubscriptionId,
      );

    if (!subscription) {
      console.warn(
        `[MercadoPagoWebhook] Suscripción no encontrada para externalId: ${data.externalSubscriptionId}`,
      );
      return;
    }

    switch (data.status) {
      case 'active':
        // Activar suscripción - el usuario pagó exitosamente
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.lastBillingDate = new Date(data.lastBillingDate);
        subscription.nextBillingDate = new Date(data.nextBillingDate);
        subscription.autoRecurrent = true;
        await this.subscriptionRepository.save(subscription);
        break;

      case 'cancelled':
        // Usuario canceló la suscripción
        subscription.status = SubscriptionStatus.CANCELED;
        subscription.autoRecurrent = false;
        await this.subscriptionRepository.save(subscription);
        break;

      case 'paused':
      case 'expired':
        // Sospender por falta de pago
        subscription.status = SubscriptionStatus.SUSPENDED;
        subscription.autoRecurrent = false;
        await this.subscriptionRepository.save(subscription);
        break;

      case 'pending':
        // La suscripción fue creada pero el primer pago aún no se procesó
        subscription.status = SubscriptionStatus.PENDING_PAYMENT;
        subscription.externalSubscriptionId = data.id;
        await this.subscriptionRepository.save(subscription);
        break;
    }
  }

  /**
   * Procesa evento de payment (cobro)
   *
   * Topics: payment
   * Actions: success, failure
   */
  async handlePaymentEvent(data: {
    id: string;
    status: 'approved' | 'pending' | 'rejected';
    externalSubscriptionId: string;
    paymentType: string;
    transactionAmount: number;
  }): Promise<void> {
    console.log(
      `[MercadoPagoWebhook] Payment event: ${data.id} - ${data.status}`,
    );

    const subscription =
      await this.subscriptionRepository.findByExternalSubscriptionId(
        data.externalSubscriptionId,
      );

    if (!subscription) {
      console.warn(
        `[MercadoPagoWebhook] Suscripción no encontrada para externalId: ${data.externalSubscriptionId}`,
      );
      return;
    }

    switch (data.status) {
      case 'approved':
        // Cobro exitoso - renovar suscripción
        subscription.lastBillingDate = new Date();
        subscription.amountPaid =
          Number(subscription.amountPaid) + data.transactionAmount;
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.autoRecurrent = true;
        await this.subscriptionRepository.save(subscription);
        break;

      case 'pending':
        // Pago pendiente de confirmación
        subscription.status = SubscriptionStatus.PENDING_PAYMENT;
        await this.subscriptionRepository.save(subscription);
        break;

      case 'rejected':
        // Pago rechazado - suspender temporalmente
        subscription.status = SubscriptionStatus.SUSPENDED;
        subscription.autoRecurrent = false;
        await this.subscriptionRepository.save(subscription);
        break;
    }
  }
}
