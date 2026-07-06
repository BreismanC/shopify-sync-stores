import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { OnboardingStatus } from '../../../domain/enums/onboarding-status.enum';

const DEFAULT_EXEMPT_PATTERNS: RegExp[] = [
  /^\/api\/auth(\/|$)/,
  /^\/api\/onboarding(\/|$)/,
  /^\/api\/webhooks(\/|$)/,
  /^\/api\/health(\/|$)/,
  /^\/api\/plans(\/|$)/,
];

/**
 * OnboardingGuard
 *
 * Bloquea el acceso a endpoints que requieren un onboarding completo.
 * NO se aplica como APP_GUARD global; cada controller que lo necesite debe
 * declararlo con @UseGuards(OnboardingGuard) o vía un Mixin.
 *
 * Reglas:
 * - Si el usuario no tiene `onboardingStatus` definido o no es COMPLETED,
 *   el acceso es denegado, salvo que la URL matchee un patrón exento.
 * - Patrones exentos por defecto: /api/auth, /api/onboarding, /api/webhooks, /api/health.
 * - Para reusar el guard en un controller específico, el controller debe
 *   venir después del JwtAuthGuard en la cadena.
 *
 * Para customizar los patrones exentos, usar `OnboardingGuard.forRoot(patterns)`
 * y registrar la versión custom en el módulo.
 */
@Injectable()
export class OnboardingGuard implements CanActivate {
  protected exemptPatterns: RegExp[] = DEFAULT_EXEMPT_PATTERNS;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user: {
        id: string;
        email: string;
        name: string;
        tenantId: string;
        role: string;
        onboardingStatus?: OnboardingStatus;
      };
      url: string;
    }>();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (this.isExempt(request.url)) {
      return true;
    }

    if (!user.onboardingStatus) {
      return true;
    }

    if (user.onboardingStatus === OnboardingStatus.COMPLETED) {
      return true;
    }

    throw new ForbiddenException({
      message: 'Debes completar el onboarding para acceder a este recurso.',
      error: 'ONBOARDING_REQUIRED',
      onboardingStatus: user.onboardingStatus,
    });
  }

  protected isExempt(url: string): boolean {
    return this.exemptPatterns.some((pattern) => pattern.test(url));
  }

  static forRoot(patterns: RegExp[]): typeof OnboardingGuard {
    class CustomOnboardingGuard extends OnboardingGuard {
      constructor() {
        super();
        this.exemptPatterns = patterns;
      }
    }
    return CustomOnboardingGuard as typeof OnboardingGuard;
  }
}
