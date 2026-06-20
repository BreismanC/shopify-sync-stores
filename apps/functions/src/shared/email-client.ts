/**
 * EmailClient allows Lambda functions to send emails via HTTP calls to the backend.
 * Lambdas cannot inject NestJS services directly, so they use this HTTP client instead.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export class EmailClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  }

  /**
   * Sends an email by calling the backend's internal email endpoint.
   * The backend authenticates internal calls via an internal API key.
   */
  async sendEmail(payload: EmailPayload): Promise<void> {
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      throw new Error('INTERNAL_API_KEY environment variable is not set');
    }

    const response = await fetch(`${this.baseUrl}/api/internal/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Api-Key': internalApiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send email: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  /**
   * Sends a trial expiring notification email.
   */
  async sendTrialExpiring(params: { to: string; userName: string; daysLeft: number; planName: string }): Promise<void> {
    await this.sendEmail({
      to: params.to,
      subject: 'Tu período de prueba está por terminar',
      template: 'trialExpiring',
      data: params,
    });
  }

  /**
   * Sends a trial expired notification email.
   */
  async sendTrialExpired(params: { to: string; userName: string; tenantName: string }): Promise<void> {
    await this.sendEmail({
      to: params.to,
      subject: 'Tu período de prueba ha terminado',
      template: 'trialExpired',
      data: params,
    });
  }

  /**
   * Sends a payment success notification email.
   */
  async sendPaymentSuccess(params: { to: string; userName: string; amount: number; planName: string; nextBillingDate: Date; billingPeriod: string }): Promise<void> {
    await this.sendEmail({
      to: params.to,
      subject: 'Pago confirmado',
      template: 'paymentSuccess',
      data: params,
    });
  }

  /**
   * Sends a payment failed notification email.
   */
  async sendPaymentFailed(params: { to: string; userName: string; reason: string }): Promise<void> {
    await this.sendEmail({
      to: params.to,
      subject: 'Pago no procesó correctamente',
      template: 'paymentFailed',
      data: { ...params, retryLink: `${process.env.SITE_URL || 'https://app.shopifysync.com'}/subscription` },
    });
  }

  /**
   * Sends a subscription suspended notification email.
   */
  async sendSubscriptionSuspended(params: { to: string; userName: string; reason: string; suspendedDate: Date }): Promise<void> {
    await this.sendEmail({
      to: params.to,
      subject: 'Tu suscripción ha sido suspendida',
      template: 'subscriptionSuspended',
      data: { ...params, reactivateLink: `${process.env.SITE_URL || 'https://app.shopifysync.com'}/subscription` },
    });
  }

  /**
   * Sends a subscription canceled notification email.
   */
  async sendSubscriptionCanceled(params: { to: string; userName: string; canceledDate: Date }): Promise<void> {
    await this.sendEmail({
      to: params.to,
      subject: 'Tu suscripción ha sido cancelada',
      template: 'subscriptionCanceled',
      data: { ...params, feedbackLink: `${process.env.SITE_URL || 'https://app.shopifysync.com'}/feedback/cancellation` },
    });
  }

  /**
   * Sends an upcoming billing reminder email.
   */
  async sendUpcomingBilling(params: { to: string; userName: string; amount: number; nextBillingDate: Date; planName: string }): Promise<void> {
    await this.sendEmail({
      to: params.to,
      subject: 'Próximo cobro en 3 días',
      template: 'upcomingBilling',
      data: params,
    });
  }
}

// Singleton instance for reuse across Lambda invocations
let emailClientInstance: EmailClient | null = null;

export function getEmailClient(): EmailClient {
  if (!emailClientInstance) {
    emailClientInstance = new EmailClient();
  }
  return emailClientInstance;
}