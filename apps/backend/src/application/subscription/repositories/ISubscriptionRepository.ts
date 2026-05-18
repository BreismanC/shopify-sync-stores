import { Subscription } from '../../../domain/entities/subscription.entity';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum';

export abstract class ISubscriptionRepository {
  abstract findByTenantId(tenantId: string): Promise<Subscription | null>;
  abstract save(subscription: Subscription): Promise<Subscription>;
  abstract create(subscription: Partial<Subscription>): Subscription;
  abstract findExpired(now: Date): Promise<Subscription[]>;
  abstract updateStatus(id: string, status: SubscriptionStatus): Promise<void>;
}
