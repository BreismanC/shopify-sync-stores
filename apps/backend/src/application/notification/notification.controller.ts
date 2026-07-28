import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import {
  GetNotificationsUseCase,
  UpdateNotificationUseCase,
} from './notification.use-cases';

interface TenantRequest {
  user: { id: string };
  tenantId: string;
}

@Controller('tenant/:tenantId/notifications')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class NotificationController {
  constructor(
    private readonly getNotifications: GetNotificationsUseCase,
    private readonly updateNotification: UpdateNotificationUseCase,
  ) {}

  @Get()
  list(
    @Req() req: TenantRequest,
    @Query('state') state = 'all',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
  ) {
    const safeState = ['all', 'unread', 'read', 'archived'].includes(state)
      ? (state as 'all' | 'unread' | 'read' | 'archived')
      : 'all';
    return this.getNotifications.execute(req.tenantId, req.user.id, {
      state: safeState,
      page: Math.max(1, page),
      perPage: Math.min(100, Math.max(1, perPage)),
    });
  }

  @Patch(':id/read')
  read(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.updateNotification.execute(req.tenantId, id, 'read');
  }

  @Patch(':id/archive')
  archive(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.updateNotification.execute(req.tenantId, id, 'archive');
  }

  @Post('read-all')
  async readAll(@Req() req: TenantRequest) {
    return {
      updated: await this.updateNotification.all(
        req.tenantId,
        req.user.id,
        'read',
      ),
    };
  }

  @Post('archive-all')
  async archiveAll(@Req() req: TenantRequest) {
    return {
      updated: await this.updateNotification.all(
        req.tenantId,
        req.user.id,
        'archive',
      ),
    };
  }
}
