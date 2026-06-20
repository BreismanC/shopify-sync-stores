import { Subscription } from '../../../domain/entities/subscription.entity';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum';

export abstract class ISubscriptionRepository {
  abstract findByTenantId(tenantId: string): Promise<Subscription | null>;
  abstract findByExternalSubscriptionId(
    externalSubscriptionId: string,
  ): Promise<Subscription | null>;
  abstract save(subscription: Subscription): Promise<Subscription>;
  abstract create(subscription: Partial<Subscription>): Subscription;
  abstract findExpired(now: Date): Promise<Subscription[]>;
  abstract findPendingPayment(olderThanHours: number): Promise<Subscription[]>;
  abstract findByNextBillingDate(beforeDate: Date): Promise<Subscription[]>;
  abstract updateStatus(id: string, status: SubscriptionStatus): Promise<void>;
  abstract findOverdue(daysOverdue: number): Promise<Subscription[]>;
}
