import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { IDashboardRepository } from './dashboard.repository';

@Controller('tenant/:tenantId/dashboard')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class DashboardController {
  constructor(private readonly dashboard: IDashboardRepository) {}
  @Get() metrics(@Req() req: { tenantId: string }) {
    return this.dashboard.metrics(req.tenantId);
  }
}
