import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { OnboardingStatus } from '../../../domain/enums/onboarding-status.enum';

@Injectable()
export class OnboardingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user: {
        id: string;
        email: string;
        name: string;
        tenantId: string;
        role: string;
        onboardingStatus: OnboardingStatus;
      };
      url: string;
    }>();
    const user = request.user;

    if (!user) {
      return false;
    }

    const { onboardingStatus } = user;

    // If user has completed onboarding, allow access to everything
    if (onboardingStatus === OnboardingStatus.COMPLETED) {
      return true;
    }

    // Allow access to onboarding routes even if not completed
    if (request.url.includes('/onboarding')) {
      return true;
    }

    // Otherwise, deny access
    throw new ForbiddenException('Please complete your onboarding first.');
  }
}
