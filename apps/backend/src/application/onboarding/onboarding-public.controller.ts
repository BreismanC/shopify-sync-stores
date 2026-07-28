import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

/**
 * Endpoints del flujo de onboarding que NO requieren JWT de sesión.
 * Se usan desde la página `/payments/status`, que vive fuera del grupo
 * `(protected)` del frontend para que MercadoPago pueda redirigir
 * cross-site sin chocar con el guard de sesión de NextAuth.
 *
 * La autorización se hace por **token firmado** (emitido por
 * `MercadoPagoTokenService` al crear la suscripción). El token tiene
 * TTL corto y valida que el `preapprovalId` de la query coincida con
 * el del payload.
 */
@Controller('onboarding/public')
export class OnboardingPublicController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * GET /api/onboarding/public/preapproval-status
   *
   * Query params:
   *   - preapproval_id: id del preapproval en MercadoPago
   *   - token: token firmado corto emitido al crear la suscripción
   *
   * Devuelve el estado del preapproval + estado de la subscription
   * local + onboardingStatus del owner del tenant (para que la página
   * pública sepa a dónde redirigir).
   */
  @Get('preapproval-status')
  async getPreapprovalStatus(
    @Query('preapproval_id') preapprovalId?: string,
    @Query('token') token?: string,
  ) {
    if (!preapprovalId) {
      throw new BadRequestException('preapproval_id es requerido');
    }
    if (!token) {
      throw new BadRequestException('token es requerido');
    }

    return this.onboardingService.getPreapprovalStatusPublic(
      preapprovalId,
      token,
    );
  }
}
