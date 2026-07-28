import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuthModule } from './application/auth/auth.module';
import { TenantModule } from './application/tenant/tenant.module';
import { SubscriptionModule } from './application/subscription/subscription.module';
import { StoreModule } from './application/store/store.module';
import { TeamMemberModule } from './application/team-member/team.module';
import { TeamInvitationModule } from './application/team-invitation/team-invitation.module';
import { OnboardingModule } from './application/onboarding/onboarding.module';
import { MercadoPagoModule } from './infrastructure/mercadopago/mercadopago.module';
import { EmailModule } from './infrastructure/services/email/email.module';
import { RealtimeModule } from './infrastructure/realtime/realtime.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { SyncModule } from './application/sync/sync.module';
import { WebhookModule } from './application/webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 300000, // 5 min
        limit: 3,
      },
    ]),
    DatabaseModule,
    QueueModule,
    AuthModule,
    TenantModule,
    SubscriptionModule,
    StoreModule,
    TeamMemberModule,
    TeamInvitationModule,
    OnboardingModule,
    MercadoPagoModule,
    EmailModule,
    RealtimeModule,
    SyncModule,
    WebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
