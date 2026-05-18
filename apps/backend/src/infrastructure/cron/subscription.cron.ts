import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ISubscriptionRepository } from '../../application/subscription/repositories/ISubscriptionRepository';
import { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';

@Injectable()
export class SubscriptionCron {
  private readonly logger = new Logger(SubscriptionCron.name);

  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionExpirations() {
    this.logger.log('Running subscription expiration check...');

    const now = new Date();
    const expiredSubscriptions =
      await this.subscriptionRepository.findExpired(now);

    for (const subscription of expiredSubscriptions) {
      await this.subscriptionRepository.updateStatus(
        subscription.id,
        SubscriptionStatus.EXPIRED,
      );
      this.logger.log(
        `Subscription ${subscription.id} has been marked as EXPIRED.`,
      );
    }

    this.logger.log('Subscription expiration check completed.');
  }
}
