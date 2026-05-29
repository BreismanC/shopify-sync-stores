import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import PasswordResetEmail from '@repo/transactional/emails';

@Injectable()
export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private siteUrl: string;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'no-reply@yourdomain.com';
    this.siteUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.yourdomain.com';
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetLink = `${this.siteUrl}/auth/password-recovery/reset?token=${token}`;
    const html = await render(React.createElement(PasswordResetEmail, { resetLink }));

    await this.resend.emails.send({
      from: this.fromEmail,
      to: email,
      subject: 'Recuperación de contraseña',
      html,
    });
  }
}
