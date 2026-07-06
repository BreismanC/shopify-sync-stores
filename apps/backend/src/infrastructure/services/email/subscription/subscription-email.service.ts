import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import {
  TrialExpiringEmail,
  TrialExpiredEmail,
  PaymentSuccessEmail,
  PaymentFailedEmail,
  SubscriptionSuspendedEmail,
  SubscriptionCanceledEmail,
  UpcomingBillingEmail,
} from '@repo/transactional/emails/subscription';

@Injectable()
export class SubscriptionEmailService {
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly siteUrl: string;
  private readonly logger = new Logger(SubscriptionEmailService.name);

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'Shopify Sync <noreply@shopifysync.com>';
    this.siteUrl =
      this.configService.get<string>('SITE_URL') ||
      'https://app.shopifysync.com';
  }

  async sendTrialExpiring(
    userEmail: string,
    userName: string,
    daysLeft: number,
    planName: string,
  ): Promise<void> {
    const html = await render(
      React.createElement(TrialExpiringEmail, {
        userName,
        daysLeft,
        planName,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sendEmail({
      to: userEmail,
      subject: 'Tu período de prueba está por terminar',
      html,
    });
  }

  async sendTrialExpired(
    userEmail: string,
    userName: string,
    tenantName: string,
  ): Promise<void> {
    const html = await render(
      React.createElement(TrialExpiredEmail, {
        userName,
        tenantName,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sendEmail({
      to: userEmail,
      subject: 'Tu período de prueba ha terminado',
      html,
    });
  }

  async sendPaymentSuccess(
    userEmail: string,
    data: {
      userName: string;
      amount: number;
      planName: string;
      nextBillingDate: Date;
      billingPeriod: string;
    },
  ): Promise<void> {
    const html = await render(
      React.createElement(PaymentSuccessEmail, {
        ...data,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sendEmail({ to: userEmail, subject: 'Pago confirmado', html });
  }

  async sendPaymentFailed(
    userEmail: string,
    userName: string,
    reason: string,
  ): Promise<void> {
    const retryLink = `${this.siteUrl}/subscription`;
    const html = await render(
      React.createElement(PaymentFailedEmail, {
        userName,
        reason,
        retryLink,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sendEmail({
      to: userEmail,
      subject: 'Pago no procesó correctamente',
      html,
    });
  }

  async sendSubscriptionSuspended(
    userEmail: string,
    data: {
      userName: string;
      reason: string;
      suspendedDate: Date;
    },
  ): Promise<void> {
    const reactivateLink = `${this.siteUrl}/subscription`;
    const html = await render(
      React.createElement(SubscriptionSuspendedEmail, {
        ...data,
        reactivateLink,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sendEmail({
      to: userEmail,
      subject: 'Tu suscripción ha sido suspendida',
      html,
    });
  }

  async sendSubscriptionCanceled(
    userEmail: string,
    userName: string,
    canceledDate: Date,
  ): Promise<void> {
    const feedbackLink = `${this.siteUrl}/feedback/cancellation`;
    const html = await render(
      React.createElement(SubscriptionCanceledEmail, {
        userName,
        canceledDate,
        feedbackLink,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sendEmail({
      to: userEmail,
      subject: 'Tu suscripción ha sido cancelada',
      html,
    });
  }

  async sendUpcomingBilling(
    userEmail: string,
    data: {
      userName: string;
      amount: number;
      nextBillingDate: Date;
      planName: string;
    },
  ): Promise<void> {
    const html = await render(
      React.createElement(UpcomingBillingEmail, {
        ...data,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sendEmail({
      to: userEmail,
      subject: 'Próximo cobro en 3 días',
      html,
    });
  }

  private async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      this.logger.log(`Email sent to ${params.to}: ${result.data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${params.to}: ${error}`);
      throw error;
    }
  }
}
