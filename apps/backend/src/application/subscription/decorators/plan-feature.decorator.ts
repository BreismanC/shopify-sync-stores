import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '../subscription-access.service';
import { PLAN_FEATURE_KEY } from '../guards/plan-access.guard';

export const PlanFeature = (feature: FeatureKey) =>
  SetMetadata(PLAN_FEATURE_KEY, feature);
