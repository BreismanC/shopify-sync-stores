import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  IUSER_REPOSITORY,
  IUserRepository,
} from '../auth/repositories/IUserRepository';
import { ITenantRepository } from '../tenant/repositories/ITenantRepository';
import { IStoreRepository } from '../store/repositories/IStoreRepository';
import { ITeamMemberRepository } from '../team-member/repositories/ITeamMemberRepository';
import { ISubscriptionRepository } from '../subscription/repositories/ISubscriptionRepository';
import { SubscriptionService } from '../subscription/subscription.service';
import { TenantService } from '../tenant/tenant.service';
import { OnboardingStatus, ONBOARDING_STATUS_TO_STEP } from '../../domain/enums/onboarding-status.enum';
import { StoreRole } from '../../domain/enums/store-role.enum';
import { Tenant } from '../../domain/entities/tenant.entity';
import { Store } from '../../domain/entities/store.entity';
import { User } from '../../domain/entities/user.entity';
import {
  SubscriptionPlan,
  PLAN_PRICING,
} from '../../domain/enums/subscription-plan.enum';
import { BillingPeriod } from '../../domain/enums/billing-period.enum';
import { TenantStatus } from '../../domain/enums/tenant-status.enum';
import { EncryptionUtil } from '../../infrastructure/security/encryption.util';
import { MercadoPagoService } from '../../infrastructure/mercadopago/mercadopago.service';
import { TeamInvitationService } from '../team-invitation/team-invitation.service';

export interface UpsertTenantInput {
  name: string;
}

export interface ConnectStoreInput {
  shopifyShopUrl: string;
  shopifyAccessToken: string;
}

export interface SetStoreRoleInput {
  storeId: string;
  role: StoreRole;
}

export interface InviteTeamMemberInput {
  email: string;
  name: string;
  role: string;
}

export interface CreatePreferenceInput {
  planType: Exclude<SubscriptionPlan, SubscriptionPlan.TRIAL>;
  billingPeriod: BillingPeriod;
}

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(IUSER_REPOSITORY) private readonly userRepository: IUserRepository,
    private readonly tenantRepository: ITenantRepository,
    private readonly storeRepository: IStoreRepository,
    private readonly teamMemberRepository: ITeamMemberRepository,
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly subscriptionService: SubscriptionService,
    private readonly tenantService: TenantService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly teamInvitationService: TeamInvitationService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Paso 1: Tenant
  // ─────────────────────────────────────────────────────────────────────────

  async getCurrentTenant(userId: string): Promise<{ tenant: Tenant | null }> {
    const user = await this.getUser(userId);
    if (!user.tenantId) {
      return { tenant: null };
    }
    const tenant = await this.tenantRepository.findById(user.tenantId);
    return { tenant };
  }

  async upsertTenant(
    userId: string,
    input: UpsertTenantInput,
  ): Promise<{
    tenant: Tenant;
    onboardingStatus: OnboardingStatus;
  }> {
    const user = await this.requireStatus(
      userId,
      OnboardingStatus.PENDING_TENANT_CONFIG,
    );

    if (!input.name || input.name.trim().length < 3) {
      throw new BadRequestException(
        'El nombre de la empresa debe tener al menos 3 caracteres',
      );
    }

    const tenant = await this.tenantService.upsertTenant(
      userId,
      input.name.trim(),
    );

    user.tenantId = tenant.id;

    if (user.onboardingStatus === OnboardingStatus.PENDING_TENANT_CONFIG) {
      user.onboardingStatus = OnboardingStatus.PENDING_PLAN_SELECTION;
      await this.userRepository.save(user);
    }

    return { tenant, onboardingStatus: user.onboardingStatus };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Paso 2: Plan
  // ─────────────────────────────────────────────────────────────────────────

  listAvailablePlans() {
    return [
      {
        planType: SubscriptionPlan.BASIC,
        billingPeriods: [BillingPeriod.MONTHLY, BillingPeriod.YEARLY],
      },
      {
        planType: SubscriptionPlan.PRO,
        billingPeriods: [BillingPeriod.MONTHLY, BillingPeriod.YEARLY],
      },
      {
        planType: SubscriptionPlan.ENTERPRISE,
        billingPeriods: [BillingPeriod.MONTHLY, BillingPeriod.YEARLY],
      },
    ];
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.getUser(userId);
    if (!user.tenantId) {
      return { subscription: null };
    }
    const subscription = await this.subscriptionRepository.findByTenantId(
      user.tenantId,
    );
    return { subscription };
  }

  async createPreference(
    userId: string,
    input: CreatePreferenceInput,
  ): Promise<{
    preferenceId: string;
    initPoint: string;
    onboardingStatus: OnboardingStatus;
  }> {
    const user = await this.requireStatus(
      userId,
      OnboardingStatus.PENDING_PLAN_SELECTION,
    );

    if (!user.tenantId) {
      throw new BadRequestException('Tenant requerido para crear preference');
    }

    const { planType, billingPeriod } = input;
    const pricing = PLAN_PRICING[planType];
    const price =
      billingPeriod === BillingPeriod.MONTHLY
        ? pricing.monthly
        : pricing.yearly;

    const preference = await this.mercadoPagoService.createPreference({
      title: `Plan ${planType} (${billingPeriod})`,
      description: `Suscripción ${planType} ${billingPeriod} - Shopify Sync`,
      price,
      quantity: 1,
      externalReference: `tenant:${user.tenantId}:user:${userId}`,
    });

    // Actualizar la subscription a PENDING_PAYMENT sin avanzar de paso aún
    // El avance lo hace el webhook al confirmar el pago.
    await this.subscriptionService.upgradePlan(
      user.tenantId,
      planType,
      billingPeriod,
    );

    return {
      preferenceId: preference.preferenceId,
      initPoint: preference.initPoint,
      onboardingStatus: user.onboardingStatus,
    };
  }

  async skipPlanSelection(userId: string): Promise<{
    subscription: unknown;
    onboardingStatus: OnboardingStatus;
  }> {
    const user = await this.requireStatus(
      userId,
      OnboardingStatus.PENDING_PLAN_SELECTION,
    );

    if (!user.tenantId) {
      throw new BadRequestException('Tenant requerido');
    }

    // Asegurarse de que exista la subscription TRIAL (puede haber sido creada en register)
    let subscription = await this.subscriptionRepository.findByTenantId(
      user.tenantId,
    );
    if (!subscription) {
      subscription = await this.subscriptionService.createTrial(user.tenantId);
    } else if (subscription.planType !== SubscriptionPlan.TRIAL) {
      // Si el usuario skipea después de seleccionar, mantenemos la selección
      // (el webhook es el que confirma). Si la subscription sigue TRIAL, está OK.
    }

    if (user.onboardingStatus === OnboardingStatus.PENDING_PLAN_SELECTION) {
      user.onboardingStatus = OnboardingStatus.PENDING_STORE_CONFIG;
      await this.userRepository.save(user);
    }

    return { subscription, onboardingStatus: user.onboardingStatus };
  }

  /**
   * Llamado por el webhook de MercadoPago al confirmar un pago aprobado.
   * Busca la subscription por `externalSubscriptionId`, encuentra el tenant
   * y avanza al owner del tenant al paso 3 si aún estaba en plan selection.
   *
   * Devuelve `{ userId, onboardingStatus }` si se avanzó, o `null` si no
   * había nada que hacer (ej: el user ya completó el onboarding).
   */
  async advanceUserAfterPayment(
    externalSubscriptionId: string,
  ): Promise<{ userId: string; onboardingStatus: OnboardingStatus } | null> {
    const subscription =
      await this.subscriptionRepository.findByExternalSubscriptionId(
        externalSubscriptionId,
      );

    if (!subscription) {
      // La subscription puede no estar creada aún si es la primera
      // notificación. No es un error.
      return null;
    }

    const users = await this.userRepository.findByTenantId(subscription.tenantId);
    if (users.length === 0) {
      return null;
    }

    // Buscamos al primer user del tenant que esté en PENDING_PLAN_SELECTION.
    // (El owner es el que típicamente está en ese estado.)
    const target = users.find(
      (u) => u.onboardingStatus === OnboardingStatus.PENDING_PLAN_SELECTION,
    );
    if (!target) {
      return null;
    }

    target.onboardingStatus = OnboardingStatus.PENDING_STORE_CONFIG;
    await this.userRepository.save(target);

    return {
      userId: target.id,
      onboardingStatus: target.onboardingStatus,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Paso 3: Store (Shopify)
  // ─────────────────────────────────────────────────────────────────────────

  async getStoreStatus(userId: string) {
    const user = await this.getUser(userId);
    if (!user.tenantId) {
      return { store: null };
    }
    const stores = await this.storeRepository.findByTenantId(user.tenantId);
    return { store: stores[0] ?? null };
  }

  async connectStore(
    userId: string,
    input: ConnectStoreInput,
  ): Promise<{ store: Store; onboardingStatus: OnboardingStatus }> {
    const user = await this.requireStatus(
      userId,
      OnboardingStatus.PENDING_STORE_CONFIG,
    );

    if (!user.tenantId) {
      throw new BadRequestException('Tenant requerido');
    }

    // El shopifyShopId se extrae del URL (formato: nombre.myshopify.com)
    const shopifyShopId = input.shopifyShopUrl.trim();
    if (!shopifyShopId) {
      throw new BadRequestException('URL de tienda requerida');
    }

    const existing = await this.storeRepository.findByShopId(shopifyShopId);
    if (existing && existing.tenantId !== user.tenantId) {
      throw new ConflictException(
        'Esta tienda ya está conectada a otro tenant',
      );
    }

    // Cifrar el accessToken antes de persistir
    const encryptedToken = EncryptionUtil.encrypt(input.shopifyAccessToken);

    const store =
      existing ??
      this.storeRepository.create({
        shopifyShopId,
        accessToken: encryptedToken,
        tenantId: user.tenantId,
        role: StoreRole.SOURCE, // default; se sobreescribe en paso 4
        isActive: true,
      });

    store.accessToken = encryptedToken;
    store.tenantId = user.tenantId;
    store.isActive = true;
    const saved = await this.storeRepository.save(store);

    if (user.onboardingStatus === OnboardingStatus.PENDING_STORE_CONFIG) {
      user.onboardingStatus = OnboardingStatus.PENDING_STORE_ROLE;
      await this.userRepository.save(user);
    }

    return { store: saved, onboardingStatus: user.onboardingStatus };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Paso 4: Store role
  // ─────────────────────────────────────────────────────────────────────────

  async setStoreRole(
    userId: string,
    input: SetStoreRoleInput,
  ): Promise<{ store: Store; onboardingStatus: OnboardingStatus }> {
    const user = await this.requireStatus(
      userId,
      OnboardingStatus.PENDING_STORE_ROLE,
    );

    if (!user.tenantId) {
      throw new BadRequestException('Tenant requerido');
    }

    const stores = await this.storeRepository.findByTenantId(user.tenantId);
    const store = stores.find((s) => s.id === input.storeId);
    if (!store) {
      throw new NotFoundException('Tienda no encontrada');
    }

    store.role = input.role;
    const saved = await this.storeRepository.save(store);

    if (user.onboardingStatus === OnboardingStatus.PENDING_STORE_ROLE) {
      user.onboardingStatus = OnboardingStatus.PENDING_TEAM_CONFIG;
      await this.userRepository.save(user);
    }

    return { store: saved, onboardingStatus: user.onboardingStatus };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Paso 5: Team
  // ─────────────────────────────────────────────────────────────────────────

  async listTeam(userId: string) {
    const user = await this.getUser(userId);
    if (!user.tenantId) {
      return { team: [] };
    }
    // Devolvemos las invitaciones (pendientes + aceptadas/revocadas)
    const team = await this.teamInvitationService.listByTenant(user.tenantId);
    return { team };
  }

  async inviteTeamMember(
    userId: string,
    input: InviteTeamMemberInput,
  ): Promise<{ member: import('../../domain/entities/team_member.entity').TeamInvitation }> {
    const user = await this.requireStatus(
      userId,
      OnboardingStatus.PENDING_TEAM_CONFIG,
    );

    if (!user.tenantId) {
      throw new BadRequestException('Tenant requerido');
    }

    const invitation = await this.teamInvitationService.createAndSend(
      user.tenantId,
      user.id,
      input,
    );
    return { member: invitation };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Final: Complete
  // ─────────────────────────────────────────────────────────────────────────

  async complete(userId: string): Promise<{
    onboardingStatus: OnboardingStatus;
  }> {
    const user = await this.requireStatus(
      userId,
      OnboardingStatus.PENDING_TEAM_CONFIG,
    );

    if (!user.tenantId) {
      throw new BadRequestException(
        'Tenant requerido para completar onboarding',
      );
    }

    user.onboardingStatus = OnboardingStatus.COMPLETED;
    await this.userRepository.save(user);

    // Activar tenant (de TRIAL a ACTIVE)
    const tenant = await this.tenantRepository.findById(user.tenantId);
    if (tenant) {
      tenant.status = TenantStatus.ACTIVE;
      await this.tenantRepository.save(tenant);
    }

    return { onboardingStatus: user.onboardingStatus };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async getUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  private async requireStatus(
    userId: string,
    expected: OnboardingStatus,
  ): Promise<User> {
    return this.requireStepReachable(userId, expected);
  }

  /**
   * Permite editar un step si el user está en ese step o ya lo superó.
   * Falla con 409 solo si el user intenta editar un step al que todavía
   * no llegó (no debe poder saltarse pasos hacia adelante).
   */
  private async requireStepReachable(
    userId: string,
    expected: OnboardingStatus,
  ): Promise<User> {
    const user = await this.getUser(userId);
    if (user.onboardingStatus === OnboardingStatus.COMPLETED) {
      return user;
    }
    const currentStep = ONBOARDING_STATUS_TO_STEP[user.onboardingStatus];
    const targetStep = ONBOARDING_STATUS_TO_STEP[expected];
    if (currentStep < targetStep) {
      throw new ConflictException({
        message: `Estado de onboarding inválido. Esperado: ${expected}, actual: ${user.onboardingStatus}`,
        current: user.onboardingStatus,
        expected,
      });
    }
    return user;
  }
}
