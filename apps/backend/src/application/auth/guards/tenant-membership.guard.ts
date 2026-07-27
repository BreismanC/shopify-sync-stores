import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TenantService } from '../../tenant/tenant.service';

@Injectable()
export class TenantMembershipGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: { id?: string; tenantId?: string | null };
      params?: { tenantId?: string };
      tenantId?: string;
    }>();
    const userId = request.user?.id;
    const routeTenantId = request.params?.tenantId;
    if (!userId || !routeTenantId) {
      throw new ForbiddenException('Contexto de tenant inválido.');
    }
    if (request.user?.tenantId !== routeTenantId) {
      throw new ForbiddenException(
        'Selecciona este tenant antes de acceder a sus recursos.',
      );
    }
    await this.tenantService.requireMembership(userId, routeTenantId);
    request.tenantId = routeTenantId;
    return true;
  }
}
