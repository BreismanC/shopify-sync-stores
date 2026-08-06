import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpStatus,
  Inject, Post, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ISubscriptionRepository } from './repositories/ISubscriptionRepository';
import { SubscriptionService } from './subscription.service';
import { MercadoPagoService } from '../../infrastructure/mercadopago/mercadopago.service';
import { IUSER_REPOSITORY, IUserRepository } from '../auth/repositories/IUserRepository';
import { BillingPeriod } from '../../domain/enums/billing-period.enum';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';

interface RequestWithUser extends Request { user: { id: string; tenantId?: string } }

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly mercadoPagoService: MercadoPagoService,
    @Inject(IUSER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  @Get('me')
  async getCurrent(@Req() req: RequestWithUser) {
    const result = await this.subscriptionService.getSubscriptionWithAccess(this.requireTenant(req));
    return { ...result, subscription: this.serialize(result.subscription) };
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Req() req: RequestWithUser, @Body() body: { reason?: string }) {
    const tenantId = this.requireTenant(req);
    const subscription = await this.subscriptionRepository.findByTenantId(tenantId);
    if (!subscription) throw new BadRequestException('Suscripción no encontrada');
    if (subscription.externalSubscriptionId) {
      const canceled = await this.mercadoPagoService.cancelPreapproval(subscription.externalSubscriptionId);
      if (!canceled) throw new BadRequestException('Mercado Pago no pudo cancelar la suscripción');
    }
    const updated = await this.subscriptionService.cancelSubscription(tenantId, body?.reason ?? 'Cancelación desde el portal');
    return { subscription: this.serialize(updated) };
  }

  @Post('create-preapproval')
  @HttpCode(HttpStatus.OK)
  async createPreapproval(@Req() req: RequestWithUser, @Body() body: { planType: SubscriptionPlan; billingPeriod: BillingPeriod }) {
    const tenantId = this.requireTenant(req);
    if (!Object.values(SubscriptionPlan).includes(body.planType) || body.planType === SubscriptionPlan.TRIAL) throw new BadRequestException('Plan inválido');
    if (!Object.values(BillingPeriod).includes(body.billingPeriod)) throw new BadRequestException('Periodo de facturación inválido');
    const user = await this.userRepository.findById(req.user.id);
    if (!user?.email) throw new BadRequestException('El usuario no tiene un email válido');
    const preapproval = await this.mercadoPagoService.createPreapproval({ planType: body.planType, billingPeriod: body.billingPeriod, payerEmail: user.email, tenantId });
    await this.subscriptionService.upgradePlan(tenantId, body.planType, body.billingPeriod, preapproval.externalSubscriptionId);
    return preapproval;
  }

  private requireTenant(req: RequestWithUser): string {
    if (!req.user.tenantId) throw new BadRequestException('Tenant requerido');
    return req.user.tenantId;
  }

  private serialize(subscription: any) { return { ...subscription, amountPaid: Number(subscription.amountPaid ?? 0) }; }
}
