import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './resend.service';
import { SubscriptionEmailService } from './subscription/subscription-email.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, SubscriptionEmailService],
  exports: [EmailService, SubscriptionEmailService],
})
export class EmailModule {}
