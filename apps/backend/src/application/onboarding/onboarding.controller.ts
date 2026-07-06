import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import { UpsertTenantDto } from './dtos/upsert-tenant.dto';
import { ConnectStoreDto } from './dtos/connect-store.dto';
import { SetStoreRoleDto } from './dtos/set-store-role.dto';
import { CreatePreferenceDto } from './dtos/create-preference.dto';

interface RequestWithUser extends Request {
  user: {
    id: string;
    tenantId?: string;
    [key: string]: any;
  };
}

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ─── Paso 1: Tenant ──────────────────────────────────────────────────────

  @Get('tenant')
  async getTenant(@Req() req: RequestWithUser) {
    return this.onboardingService.getCurrentTenant(req.user.id);
  }

  @Post('tenant')
  @HttpCode(HttpStatus.OK)
  async upsertTenant(
    @Req() req: RequestWithUser,
    @Body() body: UpsertTenantDto,
  ) {
    return this.onboardingService.upsertTenant(req.user.id, body);
  }

  // ─── Paso 2: Plan ────────────────────────────────────────────────────────

  @Get('plans')
  listPlans() {
    return { plans: this.onboardingService.listAvailablePlans() };
  }

  @Get('subscription/status')
  async getSubscriptionStatus(@Req() req: RequestWithUser) {
    return this.onboardingService.getSubscriptionStatus(req.user.id);
  }

  /**
   * Polling endpoint: consulta el estado de un preapproval en MP y devuelve
   * la información de suscripción local asociada y el onboardingStatus del
   * usuario solicitante. El frontend lo usa en /payments/status mientras
   * espera la redirección de MP.
   *
   * Requiere autenticación y que el user pertenezca al tenant de la
   * suscripción del preapproval.
   */
  @Get('subscription/preapproval/:preapprovalId')
  async getPreapprovalStatus(
    @Req() req: RequestWithUser,
    @Param('preapprovalId') preapprovalId: string,
  ) {
    return this.onboardingService.getPreapprovalStatus(
      req.user.id,
      preapprovalId,
    );
  }

  @Post('preference')
  @HttpCode(HttpStatus.OK)
  async createSubscription(
    @Req() req: RequestWithUser,
    @Body() body: CreatePreferenceDto,
  ) {
    return this.onboardingService.createSubscription(req.user.id, body);
  }

  @Post('subscription/skip')
  @HttpCode(HttpStatus.OK)
  async skipSubscription(@Req() req: RequestWithUser) {
    return this.onboardingService.skipPlanSelection(req.user.id);
  }

  // ─── Paso 3: Store ────────────────────────────────────────────────────────

  @Get('store/status')
  async getStoreStatus(@Req() req: RequestWithUser) {
    return this.onboardingService.getStoreStatus(req.user.id);
  }

  @Post('store/connect')
  @HttpCode(HttpStatus.OK)
  async connectStore(
    @Req() req: RequestWithUser,
    @Body() body: ConnectStoreDto,
  ) {
    return this.onboardingService.connectStore(req.user.id, body);
  }

  // ─── Paso 4: Store role ──────────────────────────────────────────────────

  @Post('store/role')
  @HttpCode(HttpStatus.OK)
  async setStoreRole(
    @Req() req: RequestWithUser,
    @Body() body: SetStoreRoleDto,
  ) {
    return this.onboardingService.setStoreRole(req.user.id, body);
  }

  // ─── Final: Complete ─────────────────────────────────────────────────────

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async complete(@Req() req: RequestWithUser) {
    return this.onboardingService.complete(req.user.id);
  }
}
