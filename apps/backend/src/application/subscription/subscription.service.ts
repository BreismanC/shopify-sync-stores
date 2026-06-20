import { Injectable } from '@nestjs/common';
import { ISubscriptionRepository } from './repositories/ISubscriptionRepository';
import { Subscription } from '../../domain/entities/subscription.entity';
import {
  SubscriptionPlan,
  PLAN_PRICING,
} from '../../domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';
import { BillingPeriod } from '../../domain/enums/billing-period.enum';

export interface SubscriptionWithAccess {
  subscription: Subscription;
  maxConnections: number;
  maxStores: number;
  maxTeamMembers: number;
}

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
    date.setDate(date.getDate() + 7);
    return date;
  }

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findByTenantId(tenantId);
  }

  async upgradePlan(
    tenantId: string,
    newPlan: SubscriptionPlan,
    billingPeriod: BillingPeriod,
  ): Promise<Subscription> {
    const subscription =
      await this.subscriptionRepository.findByTenantId(tenantId);
    if (!subscription) {
      throw new Error('Suscripción no encontrada');
    }

    subscription.planType = newPlan;
    subscription.billingPeriod = billingPeriod;
    subscription.status = SubscriptionStatus.PENDING_PAYMENT;

    return this.subscriptionRepository.save(subscription);
  }

  async cancelSubscription(
    tenantId: string,
    reason: string,
  ): Promise<Subscription> {
    const subscription =
      await this.subscriptionRepository.findByTenantId(tenantId);
    if (!subscription) {
      throw new Error('Suscripción no encontrada');
    }

    subscription.autoRecurrent = false;
    subscription.status = SubscriptionStatus.CANCELED;

    return this.subscriptionRepository.save(subscription);
  }

  async reactivateSubscription(tenantId: string): Promise<Subscription> {
    const subscription =
      await this.subscriptionRepository.findByTenantId(tenantId);
    if (!subscription) {
      throw new Error('Suscripción no encontrada');
    }

    subscription.status = SubscriptionStatus.ACTIVE;

    return this.subscriptionRepository.save(subscription);
  }

  async getSubscriptionWithAccess(
    tenantId: string,
  ): Promise<SubscriptionWithAccess> {
    const subscription =
      await this.subscriptionRepository.findByTenantId(tenantId);
    if (!subscription) {
      throw new Error('Suscripción no encontrada');
    }

    const limits = this.getPlanLimits(subscription.planType);

    return {
      subscription,
      maxConnections: limits.maxConnections,
      maxStores: limits.maxStores,
      maxTeamMembers: limits.maxTeamMembers,
    };
  }

  private getPlanLimits(plan: SubscriptionPlan) {
    switch (plan) {
      case SubscriptionPlan.TRIAL:
        return { maxConnections: 1, maxStores: 1, maxTeamMembers: 0 };
      case SubscriptionPlan.BASIC:
        return { maxConnections: 3, maxStores: 2, maxTeamMembers: 3 };
      case SubscriptionPlan.PRO:
        return { maxConnections: 10, maxStores: 5, maxTeamMembers: 10 };
      case SubscriptionPlan.ENTERPRISE:
        return { maxConnections: -1, maxStores: -1, maxTeamMembers: -1 };
      default:
        return { maxConnections: 0, maxStores: 0, maxTeamMembers: 0 };
    }
  }
}
