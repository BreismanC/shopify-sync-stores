import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  SubscriptionAccessService,
  FeatureKey,
} from '../subscription-access.service';

export const PLAN_FEATURE_KEY = 'planFeature';

@Injectable()
export class PlanAccessGuard implements CanActivate {
  constructor(
    private readonly subscriptionAccessService: SubscriptionAccessService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.get<FeatureKey>(
      PLAN_FEATURE_KEY,
      context.getHandler(),
    );

    if (!feature) {
      // No feature required, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant not found');
    }

    const canAccess = await this.subscriptionAccessService.canAccessFeature(
      tenantId,
      feature,
    );

    if (!canAccess) {
      throw new ForbiddenException(
        `This feature is not available on your current plan. Please upgrade to access it.`,
      );
    }

    return true;
  }
}
