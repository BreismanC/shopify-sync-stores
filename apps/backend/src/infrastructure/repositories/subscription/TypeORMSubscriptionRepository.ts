import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Subscription } from '../../../domain/entities/subscription.entity';
import { ISubscriptionRepository } from '../../../application/subscription/repositories/ISubscriptionRepository';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum';

@Injectable()
export class TypeORMSubscriptionRepository implements ISubscriptionRepository {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({ where: { tenantId } });
  }

  async save(subscription: Subscription): Promise<Subscription> {
    return this.subscriptionRepository.save(subscription);
  }

  create(subscription: Partial<Subscription>): Subscription {
    return this.subscriptionRepository.create(subscription);
  }

  async findExpired(now: Date): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: {
        trialEndDate: LessThan(now),
        status: SubscriptionStatus.ACTIVE,
      },
    });
  }

  async updateStatus(id: string, status: SubscriptionStatus): Promise<void> {
    await this.subscriptionRepository.update(id, { status });
  }
}
