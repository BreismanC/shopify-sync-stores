import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
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
import { PayoutStatus } from '../../domain/enums/sync-status.enum';
import {
  GetOrderDetailUseCase,
  GetOrdersUseCase,
  PushOrderToSourceUseCase,
} from './order.use-cases';
import { IOrderRepository } from './repositories/order.repository';

interface PushOrderDto {
  shippingFee?: number | string | null;
}

@Controller('tenant/:tenantId')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class OrderController {
  constructor(
    private readonly getOrders: GetOrdersUseCase,
    private readonly getOrderDetail: GetOrderDetailUseCase,
    private readonly pushOrder: PushOrderToSourceUseCase,
    private readonly orders: IOrderRepository,
  ) {}
  @Get('orders')
  async list(
    @Req() req: { tenantId: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'updatedAt' | 'status',
    @Query('order') order?: 'asc' | 'desc',
  ) {
    const allowedSortBy = ['createdAt', 'updatedAt', 'status'] as const;
    const safeSortBy: 'createdAt' | 'updatedAt' | 'status' =
      allowedSortBy.includes(sortBy as (typeof allowedSortBy)[number])
        ? ((sortBy as (typeof allowedSortBy)[number]) ?? 'createdAt')
        : 'createdAt';
    const safeOrder: 'asc' | 'desc' =
      order === 'asc' || order === 'desc' ? order : 'desc';
    const result = await this.getOrders.execute(req.tenantId, {
      page: Math.max(1, page),
      perPage: Math.min(100, Math.max(1, perPage)),
      search,
      status,
      storeId,
      sortBy: safeSortBy,
      order: safeOrder,
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

  @Get('orders/:id')
  async detail(@Req() req: { tenantId: string }, @Param('id') id: string) {
    return this.getOrderDetail.execute(req.tenantId, id);
  }

  @Post('orders/:id/push')
  async push(
    @Req() req: { tenantId: string },
    @Param('id') id: string,
    @Body() body: PushOrderDto,
  ) {
    let shippingFee: number | null = null;
    if (body.shippingFee !== undefined && body.shippingFee !== null) {
      const parsed = Number(body.shippingFee);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new BadRequestException(
          'El envío manual debe ser un número mayor o igual a 0.',
        );
      }
      shippingFee = parsed;
    }
    return this.pushOrder.execute(req.tenantId, id, shippingFee);
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
