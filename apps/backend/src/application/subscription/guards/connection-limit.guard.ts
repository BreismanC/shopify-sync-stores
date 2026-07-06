import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { SubscriptionAccessService } from '../subscription-access.service';

// Placeholder interface until ConnectionService is created
export interface IConnectionService {
  countByTenant(tenantId: string): Promise<number>;
}

@Injectable()
export class ConnectionLimitGuard implements CanActivate {
  constructor(
    private readonly subscriptionAccessService: SubscriptionAccessService,
    @Optional()
    @Inject('CONNECTION_SERVICE')
    private readonly connectionService?: IConnectionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant not found');
    }

    // If ConnectionService is not available, allow by default
    if (!this.connectionService) {
      return true;
    }

    const currentCount = await this.connectionService.countByTenant(tenantId);
    const canAdd = await this.subscriptionAccessService.canAddConnection(
      tenantId,
      currentCount,
    );

    if (!canAdd) {
      const limits =
        await this.subscriptionAccessService.getPlanLimits(tenantId);
      throw new BadRequestException(
        `You have reached the maximum number of connections (${limits.maxConnections}) for your plan. Please upgrade to add more connections.`,
      );
    }

    return true;
  }
}
