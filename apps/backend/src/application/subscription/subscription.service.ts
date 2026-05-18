import { Injectable } from '@nestjs/common';
import { ISubscriptionRepository } from './repositories/ISubscriptionRepository';
import { Subscription } from '../../domain/entities/subscription.entity';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
  ) {}

  async createTrial(tenantId: string): Promise<Subscription> {
    const subscription = this.subscriptionRepository.create({
      tenantId,
      planType: SubscriptionPlan.TRIAL,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      trialEndDate: this.calculateTrialEndDate(),
    });

    return this.subscriptionRepository.save(subscription);
  }

  private calculateTrialEndDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date;
  }

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findByTenantId(tenantId);
  }
}
