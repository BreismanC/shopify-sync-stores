import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import PasswordResetEmail, {
  TeamInvitationEmail,
  StoreConnectionKeyEmail,
} from '@repo/transactional/emails';
import { StoreRole } from '../../../domain/enums/store-role.enum';

export interface SendStoreConnectionKeyEmailInput {
  to: string;
  senderName: string;
  role: StoreRole;
  shopifyShopId: string;
  storeKey: string;
}

@Injectable()
export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private siteUrl: string;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'no-reply@yourdomain.com';
    this.siteUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://app.yourdomain.com';
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetLink = `${this.siteUrl}/auth/password-recovery/reset?token=${token}`;
    const html = await render(
      React.createElement(PasswordResetEmail, { resetLink }),
    );

    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: 'Recuperación de contraseña',
      html,
    });
  }

  async sendTeamInvitationEmail(params: {
    to: string;
    inviterName: string;
    tenantName: string;
    role: string;
    acceptLink: string;
    expiresAt: Date;
  }) {
    const html = await render(
      React.createElement(TeamInvitationEmail, {
        inviterName: params.inviterName,
        tenantName: params.tenantName,
        role: params.role,
        acceptLink: params.acceptLink,
        expiresAt: params.expiresAt,
      }),
    );

    await this.resend.emails.send({
      from: this.fromEmail,
      to: params.to,
      subject: `${params.inviterName} te invitó a ${params.tenantName} en SyncShop`,
      html,
    });
  }

  async sendStoreConnectionKeyEmail(params: SendStoreConnectionKeyEmailInput) {
    const html = await render(
      React.createElement(StoreConnectionKeyEmail, {
        inviterName: params.senderName,
        role: params.role,
        shopifyShopId: params.shopifyShopId,
        storeKey: params.storeKey,
      }),
    );

    await this.resend.emails.send({
      from: this.fromEmail,
      to: params.to,
      subject: `Store key para conectar ${params.shopifyShopId}`,
      html,
    });
  }
}
