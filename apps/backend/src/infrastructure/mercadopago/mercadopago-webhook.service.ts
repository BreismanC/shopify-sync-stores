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
 * Verificación de firma SHA256 (formato MP v3):
 * - Header `x-signature` con formato `ts=<ts>,v1=<firma>` (separado por `,`
 *   y cada parte por `=`).
 * - Header `x-request-id` con el id de la request.
 * - Template firmado: `id:[data.id];request-id:[x-request-id];ts:[ts];`
 *   HMAC SHA256 con `MERCADOPAGO_WEBHOOK_SECRET`.
 *
 * Ref: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
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
   * Verifica la firma SHA256 del webhook de MercadoPago.
   *
   * @param signatureHeader Contenido crudo del header `x-signature`
   *   (ej: `ts=1700000000,v1=abc123...`).
   * @param requestId Valor del header `x-request-id`.
   * @param dataId ID dentro de `body.data.id` (resource id del webhook).
   */
  async verifySignature(params: {
    signatureHeader: string;
    requestId: string;
    dataId: string;
  }): Promise<boolean> {
    if (!this.webhookSecret) {
      return true; // En desarrollo sin secret, aceptamos todo
    }

    const { ts, v1 } = this.parseSignatureHeader(params.signatureHeader);
    if (!ts || !v1) {
      return false;
    }

    // Template firmado: `id:[data.id];request-id:[x-request-id];ts:[ts];`
    // El data.id puede llegar con mayúsculas; la doc oficial pide pasarlo
    // a minúsculas antes de armar el manifest.
    const signedTemplate = `id:${params.dataId.toLowerCase()};request-id:${params.requestId};ts:${ts};`;

    const expectedSignature = createHmac('sha256', this.webhookSecret)
      .update(signedTemplate)
      .digest('hex');

    return this.secureCompare(v1, expectedSignature);
  }

  /**
   * Parsea el header `x-signature` con formato `ts=1700000000,v1=abc123`.
   * Devuelve `ts` y `v1` por separado. Tolera espacios alrededor del `=`.
   */
  private parseSignatureHeader(header: string): { ts?: string; v1?: string } {
    const result: { ts?: string; v1?: string } = {};
    for (const part of header.split(',')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (key === 'ts') result.ts = value;
      else if (key === 'v1') result.v1 = value;
    }
    return result;
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
   * Procesa evento de preapproval (suscripción).
   *
   * Topics: preapproval
   * Actions: created, authorized, active, cancelled, paused, expired
   *
   * El estado "authorized" es el que MP devuelve cuando el usuario aprueba
   * el pago pendiente. Luego MP lo transiciona a "active" automáticamente.
   *
   * @param preapprovalId  ID del preapproval en MP
   * @param status         Status reportado por MP (puede ser "authorized", "active", etc.)
   * @param externalReference external_reference enviado al crear el preapproval (formato: "tenant:<tenantId>")
   * @param nextBillingDate Próxima fecha de cobro
   * @param lastBillingDate Última fecha de cobro
   */
  async handlePreapprovalEvent(data: {
    preapprovalId: string;
    status:
      | 'pending'
      | 'authorized'
      | 'active'
      | 'cancelled'
      | 'paused'
      | 'expired';
    externalReference: string | null;
    nextBillingDate: string;
    lastBillingDate: string;
  }): Promise<void> {
    let subscription =
      await this.subscriptionRepository.findByExternalSubscriptionId(
        data.preapprovalId,
      );

    if (!subscription && data.externalReference) {
      const tenantId = this.parseTenantIdFromExternalRef(
        data.externalReference,
      );
      if (tenantId) {
        subscription =
          await this.subscriptionRepository.findByTenantId(tenantId);
        if (subscription) {
          subscription.externalSubscriptionId = data.preapprovalId;
          await this.subscriptionRepository.save(subscription);
        }
      }
    }

    if (!subscription) {
      return;
    }

    switch (data.status) {
      case 'authorized':
      case 'active':
        // Pago aprobado — activar suscripción
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
        // Suspender por falta de pago
        subscription.status = SubscriptionStatus.SUSPENDED;
        subscription.autoRecurrent = false;
        await this.subscriptionRepository.save(subscription);
        break;

      case 'pending':
        // La suscripción fue creada pero el primer pago aún no se procesó
        subscription.status = SubscriptionStatus.PENDING_PAYMENT;
        await this.subscriptionRepository.save(subscription);
        break;
    }
  }

  /**
   * Extrae el tenantId del external_reference.
   * Formato esperado: "tenant:<tenantId>"
   */
  private parseTenantIdFromExternalRef(externalRef: string): string | null {
    if (externalRef.startsWith('tenant:')) {
      return externalRef.slice(7);
    }
    return null;
  }

  /**
   * Procesa evento de payment (cobro).
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
    const subscription =
      await this.subscriptionRepository.findByExternalSubscriptionId(
        data.externalSubscriptionId,
      );

    if (!subscription) {
      return;
    }

    switch (data.status) {
      case 'approved':
        // Cobro exitoso — renovar suscripción
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
        // Pago rechazado — suspender temporalmente
        subscription.status = SubscriptionStatus.SUSPENDED;
        subscription.autoRecurrent = false;
        await this.subscriptionRepository.save(subscription);
        break;
    }
  }
}
