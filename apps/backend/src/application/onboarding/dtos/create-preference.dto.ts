import { IsEnum, IsNotIn } from 'class-validator';
import { SubscriptionPlan } from '../../../domain/enums/subscription-plan.enum';
import { BillingPeriod } from '../../../domain/enums/billing-period.enum';

export class CreatePreferenceDto {
  @IsEnum(SubscriptionPlan)
  @IsNotIn([SubscriptionPlan.TRIAL], {
    message: 'No se puede crear preference para plan TRIAL',
  })
  planType!: Exclude<SubscriptionPlan, SubscriptionPlan.TRIAL>;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;
}
