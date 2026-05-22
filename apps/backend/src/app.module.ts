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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 300000, // 5 min
      limit: 3,
    }]),
    DatabaseModule,
    AuthModule,
    TenantModule,
    SubscriptionModule,
    StoreModule,
    TeamMemberModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule {}
