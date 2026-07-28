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
 * El status se lee del TENANT (inyectado en request.user por JwtStrategy).
 *
 * Reglas:
 * - COMPLETED → acceso permitido
 * - OWNER con onboarding incompleto → Forbidden (debe completar onboarding)
 * - Miembro con PENDING_TEAM_CONFIG → acceso permitido (owner ya llegó a team)
 * - Miembro con status anterior → Forbidden
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
        isOwner?: boolean;
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

    // Miembros invitados pueden usar la app cuando el tenant llegó a team config.
    if (
      !user.isOwner &&
      user.onboardingStatus === OnboardingStatus.PENDING_TEAM_CONFIG
    ) {
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
