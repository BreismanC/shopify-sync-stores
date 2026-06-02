import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../../../infrastructure/services/email/resend.service';

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async execute(email: string) {
    const token = this.jwtService.sign({ email }, { expiresIn: '1h' });
    await this.emailService.sendPasswordResetEmail(email, token);
  }
}
