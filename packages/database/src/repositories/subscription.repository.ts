import { LessThan, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { BaseRepository } from './base.repository';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { SubscriptionPlan } from '../enums/subscription-plan.enum';

export class SubscriptionRepository extends BaseRepository<Subscription> {
  protected readonly entityClass = Subscription;

  /**
   * Find expired trials: trialEndDate < now AND status = ACTIVE AND planType = TRIAL
   */
  async findExpired(now: Date): Promise<Subscription[]> {
    return this.manager.getRepository(Subscription).find({
      where: {
        trialEndDate: LessThan(now),
        status: SubscriptionStatus.ACTIVE,
        planType: SubscriptionPlan.TRIAL,
      },
    });
  }

  /**
   * Find subscriptions in PENDING_PAYMENT older than specified hours
   */
  async findPendingPayment(olderThanHours: number): Promise<Subscription[]> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    return this.manager.getRepository(Subscription).find({
      where: {
        status: SubscriptionStatus.PENDING_PAYMENT,
      },
    });
  }

  /**
   * Find subscriptions with nextBillingDate before specified date
   */
  async findByNextBillingDate(beforeDate: Date): Promise<Subscription[]> {
    return this.manager.getRepository(Subscription).find({
      where: {
        nextBillingDate: LessThanOrEqual(beforeDate),
        autoRecurrent: true,
        status: SubscriptionStatus.ACTIVE,
      },
    });
  }

  /**
   * Update subscription status
   */
  async updateStatus(id: string, status: SubscriptionStatus): Promise<void> {
    await this.manager.getRepository(Subscription).update(id, { status });
  }

  /**
   * Find subscription by tenant ID
   */
  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    return this.manager.getRepository(Subscription).findOne({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find overdue subscriptions (SUSPENDED with payment overdue)
   */
  async findOverdue(daysOverdue: number): Promise<Subscription[]> {
    const cutoff = new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000);
    return this.manager.getRepository(Subscription).find({
      where: {
        status: SubscriptionStatus.SUSPENDED,
      },
    });
  }
}

let subscriptionRepoInstance: SubscriptionRepository | null = null;

export async function createSubscriptionRepository(): Promise<SubscriptionRepository> {
  if (!subscriptionRepoInstance) {
    subscriptionRepoInstance = new SubscriptionRepository();
  }
  return subscriptionRepoInstance;
}