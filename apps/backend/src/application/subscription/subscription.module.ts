import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../../domain/entities/subscription.entity';
import { ISubscriptionRepository } from './repositories/ISubscriptionRepository';
import { TypeORMSubscriptionRepository } from '../../infrastructure/repositories/subscription/TypeORMSubscriptionRepository';
import { SubscriptionService } from './subscription.service';
import { SubscriptionAccessService } from './subscription-access.service';
import { PlanAccessGuard } from './guards/plan-access.guard';
import { ConnectionLimitGuard } from './guards/connection-limit.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription])],
  providers: [
    {
      provide: ISubscriptionRepository,
      useClass: TypeORMSubscriptionRepository,
    },
    SubscriptionService,
    SubscriptionAccessService,
    PlanAccessGuard,
    ConnectionLimitGuard,
  ],
  exports: [
    ISubscriptionRepository,
    SubscriptionService,
    SubscriptionAccessService,
    PlanAccessGuard,
    ConnectionLimitGuard,
  ],
})
export class SubscriptionModule {}
