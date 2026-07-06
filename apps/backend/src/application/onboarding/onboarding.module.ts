import { Module, forwardRef } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingPublicController } from './onboarding-public.controller';
import { OnboardingService } from './onboarding.service';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { StoreModule } from '../store/store.module';
import { TeamMemberModule } from '../team-member/team.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MercadoPagoModule } from '../../infrastructure/mercadopago/mercadopago.module';
import { EmailModule } from '../../infrastructure/services/email/email.module';
import { TeamInvitationModule } from '../team-invitation/team-invitation.module';

/**
 * Onboarding Module
 *
 * Centraliza los endpoints del flujo de onboarding multi-step.
 * Depende de los módulos de Auth (User repo), Tenant, Store, TeamMember,
 * Subscription, MercadoPago y Email.
 *
 * Controllers:
 * - `OnboardingController`: endpoints protegidos (requieren JWT).
 * - `OnboardingPublicController`: endpoints públicos (autorización por
 *   token firmado). Usados desde la página `/payments/status` para
 *   que MP pueda redirigir cross-site sin chocar con el guard de
 *   sesión de NextAuth.
 */
@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => TenantModule),
    forwardRef(() => StoreModule),
    forwardRef(() => TeamMemberModule),
    forwardRef(() => SubscriptionModule),
    forwardRef(() => MercadoPagoModule),
    forwardRef(() => EmailModule),
    forwardRef(() => TeamInvitationModule),
  ],
  controllers: [OnboardingController, OnboardingPublicController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
