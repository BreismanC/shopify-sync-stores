import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../../domain/entities/subscription.entity';
import { ISubscriptionRepository } from './repositories/ISubscriptionRepository';
import { TypeORMSubscriptionRepository } from '../../infrastructure/repositories/subscription/TypeORMSubscriptionRepository';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription])],
  providers: [
    {
      provide: ISubscriptionRepository,
      useClass: TypeORMSubscriptionRepository,
    },
    SubscriptionService,
  ],
  exports: [ISubscriptionRepository, SubscriptionService],
})
export class SubscriptionModule {}
