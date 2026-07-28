import {
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { PayoutStatus } from '../../domain/enums/sync-status.enum';
import { GetOrdersUseCase } from './order.use-cases';
import { IOrderRepository } from './repositories/order.repository';

@Controller('tenant/:tenantId')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class OrderController {
  constructor(
    private readonly getOrders: GetOrdersUseCase,
    private readonly orders: IOrderRepository,
  ) {}
  @Get('orders')
  async list(
    @Req() req: { tenantId: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
  ) {
    const result = await this.getOrders.execute(req.tenantId, {
      page: Math.max(1, page),
      perPage: Math.min(100, Math.max(1, perPage)),
      status,
      storeId,
    });
    return {
      ...result,
      pagination: {
        page,
        perPage,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / perPage)),
      },
    };
  }
  @Patch('payouts/:payoutId/paid')
  async markPaid(
    @Req() req: { tenantId: string },
    @Param('payoutId') payoutId: string,
  ) {
    const payout = await this.orders.findPayout(req.tenantId, payoutId);
    if (!payout) throw new NotFoundException('Liquidación no encontrada.');
    payout.status = PayoutStatus.PAID;
    payout.paidAt = new Date();
    return this.orders.savePayout(payout);
  }
}
