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
import {
  OnboardingStatus,
  ONBOARDING_STATUS_TO_STEP,
} from '../../domain/enums/onboarding-status.enum';
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
import { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';
import { EncryptionUtil } from '../../infrastructure/security/encryption.util';
import { MercadoPagoService } from '../../infrastructure/mercadopago/mercadopago.service';
import { MercadoPagoTokenService } from '../../infrastructure/mercadopago/mercadopago-token.service';
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
    private readonly mercadoPagoTokenService: MercadoPagoTokenService,
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
    await this.userRepository.save(user);

    const onboardingStatus = await this.advanceTenantStatus(
      tenant,
      OnboardingStatus.PENDING_TENANT_CONFIG,
      OnboardingStatus.PENDING_PLAN_SELECTION,
    );

    return { tenant, onboardingStatus };
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

  /**
   * Consulta el estado de un preapproval en MP y lo combina con la
   * información local de la suscripción. Usado por /payments/status para polling.
   *
   * Autorización: el `userId` debe pertenecer al tenant de la suscripción
   * asociada al preapproval. Si no, lanza `ForbiddenException`.
   *
   * Devuelve además el `onboardingStatus` actual del usuario solicitante
   * para que el frontend lo use en `updateSession({ onboardingStatus })`
   * sin tener que volver a llamar a `/users/me`.
   */
  async getPreapprovalStatus(userId: string, preapprovalId: string) {
    // Consultar estado en Mercado Pago
    const mpStatus =
      await this.mercadoPagoService.getPreapprovalById(preapprovalId);

    // Buscar la suscripción local por externalSubscriptionId
    const subscription =
      await this.subscriptionRepository.findByExternalSubscriptionId(
        preapprovalId,
      );

    if (!subscription) {
      throw new NotFoundException(
        `Suscripción no encontrada para preapproval ${preapprovalId}`,
      );
    }

    // Autorización: el user debe pertenecer al tenant de la subscription
    const user = await this.getUser(userId);
    if (user.tenantId !== subscription.tenantId) {
      throw new NotFoundException(
        `Suscripción no encontrada para preapproval ${preapprovalId}`,
      );
      // Devolvemos 404 (no 403) para no filtrar la existencia del recurso
      // a usuarios no autorizados.
    }

    return {
      preapprovalId: mpStatus.id,
      mpStatus: mpStatus.status,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      externalReference: mpStatus.externalReference,
      onboardingStatus: await this.getTenantOnboardingStatus(user),
    };
  }

  /**
   * Variante pública de `getPreapprovalStatus`, pensada para la página
   * `/payments/status` (que vive fuera de `(protected)` para que MP pueda
   * redirigir cross-site sin chocar con el guard de sesión).
   *
   * Autorización por **token firmado de un solo uso** en lugar de JWT de
   * sesión. El token se emite al crear la suscripción y el frontend lo
   * guarda en `sessionStorage` antes de redirigir al `init_point` de MP.
   *
   * Si el token no es válido, está expirado, o no corresponde al
   * `preapprovalId` de la query, falla con `UnauthorizedException`.
   */
  async getPreapprovalStatusPublic(preapprovalId: string, token: string) {
    const payload = this.mercadoPagoTokenService.verify(token, preapprovalId);

    let subscription =
      await this.subscriptionRepository.findByExternalSubscriptionId(
        preapprovalId,
      );

    if (!subscription) {
      subscription = await this.subscriptionRepository.findByTenantId(
        payload.tenantId,
      );
    }

    if (!subscription) {
      throw new NotFoundException(
        `Suscripción no encontrada para preapproval ${preapprovalId}`,
      );
    }

    // Auto-vincular si la subscription está en la DB pero todavía no
    // tiene el externalSubscriptionId (idempotente con el webhook).
    if (subscription.externalSubscriptionId !== preapprovalId) {
      subscription.externalSubscriptionId = preapprovalId;
      await this.subscriptionRepository.save(subscription);
    }

    // Fallback al webhook: si la suscripción ya está ACTIVE pero el
    // usuario sigue en paso 2, avanzamos acá (race entre webhooks y
    // redirect de MP).
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      await this.advanceUserAfterPayment(preapprovalId);
    }

    const tenant = await this.tenantRepository.findById(subscription.tenantId);
    const onboardingStatus = tenant?.onboardingStatus ?? null;

    // El frontend solo debe seguir polling mientras el usuario está en
    // paso 2 Y la suscripción sigue pendiente de pago.
    const pollingRequired =
      subscription.status === SubscriptionStatus.PENDING_PAYMENT &&
      (onboardingStatus === OnboardingStatus.PENDING_PLAN_SELECTION ||
        onboardingStatus === null);

    const paymentApproved =
      subscription.status === SubscriptionStatus.ACTIVE ||
      (onboardingStatus !== null &&
        onboardingStatus !== OnboardingStatus.PENDING_TENANT_CONFIG &&
        onboardingStatus !== OnboardingStatus.PENDING_PLAN_SELECTION);

    return {
      preapprovalId,
      // mpStatus NO consulta MP: es la convención para que el cliente
      // pueda interpretar el estado. Cuando la subscription pasa a
      // ACTIVE en DB es porque el webhook validó el pago con MP.
      mpStatus: this.mapSubscriptionStatusToMpStatus(subscription.status),
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      externalReference: `tenant:${subscription.tenantId}`,
      onboardingStatus,
      pollingRequired,
      paymentApproved,
    };
  }

  /**
   * Convierte el estado interno de la subscription al equivalente que
   * espera el frontend (`mpStatus`). Como el polling ya no consulta MP,
   * mapeamos los estados de la DB a los valores terminales que el cliente
   * sabe interpretar.
   */
  private mapSubscriptionStatusToMpStatus(
    subscriptionStatus: SubscriptionStatus,
  ): string {
    switch (subscriptionStatus) {
      case SubscriptionStatus.ACTIVE:
        return 'authorized';
      case SubscriptionStatus.CANCELED:
        return 'cancelled';
      case SubscriptionStatus.SUSPENDED:
        return 'paused';
      case SubscriptionStatus.PENDING_PAYMENT:
      default:
        return 'pending';
    }
  }

  /**
   * Crea una suscripción sin plan asociado (pago pendiente via link de MP).
   * POST /v1/preapprovals
   *
   * Flujo:
   * 1. Se crea el preapproval en MP con status="pending" y auto_recurring inline
   * 2. Se devuelve el init_point para que el frontend redirija al usuario a MP
   * 3. El usuario paga en MP y es redirigido a /payments/status
   * 4. El webhook recibe la notificación y actualiza la DB
   *
   * No se debe confundir con createPreference (checkout-pro, pago único).
   */
  async createSubscription(
    userId: string,
    input: CreatePreferenceInput,
  ): Promise<{
    preapprovalId: string;
    initPoint: string;
    statusToken: string;
    onboardingStatus: OnboardingStatus;
  }> {
    const user = await this.requireStatus(
      userId,
      OnboardingStatus.PENDING_PLAN_SELECTION,
    );

    if (!user.tenantId) {
      throw new BadRequestException('Tenant requerido para crear suscripción');
    }

    const { planType, billingPeriod } = input;

    // Crear el preapproval en Mercado Pago (suscripción sin plan, pago pendiente)
    const preapproval = await this.mercadoPagoService.createPreapproval({
      planType,
      billingPeriod,
      payerEmail: user.email,
      tenantId: user.tenantId,
    });

    // Emitir token firmado corto. El frontend lo guarda en sessionStorage
    // antes de redirigir al `init_point`. Cuando MP redirige de vuelta al
    // `back_url` (cross-site), el navegador puede no reenviar la cookie
    // de sesión de NextAuth. El token acompaña la query string y le
    // permite al endpoint público validar el request.
    const statusToken = this.mercadoPagoTokenService.sign({
      preapprovalId: preapproval.externalSubscriptionId,
      tenantId: user.tenantId,
      userId: user.id,
    });

    // Actualizar la subscription local a PENDING_PAYMENT y guardar el preapproval ID.
    // El avance real al siguiente paso lo hace el webhook al confirmar el pago.
    await this.subscriptionService.upgradePlan(
      user.tenantId,
      planType,
      billingPeriod,
      preapproval.externalSubscriptionId,
    );

    return {
      preapprovalId: preapproval.externalSubscriptionId,
      initPoint: preapproval.initPoint,
      statusToken,
      onboardingStatus: await this.getTenantOnboardingStatus(user),
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

    const onboardingStatus = await this.advanceTenantByUser(
      user,
      OnboardingStatus.PENDING_PLAN_SELECTION,
      OnboardingStatus.PENDING_STORE_CONFIG,
    );

    return { subscription, onboardingStatus };
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
      return null;
    }

    const tenant = await this.tenantRepository.findById(subscription.tenantId);
    if (!tenant) {
      return null;
    }

    if (tenant.onboardingStatus !== OnboardingStatus.PENDING_PLAN_SELECTION) {
      return null;
    }

    tenant.onboardingStatus = OnboardingStatus.PENDING_STORE_CONFIG;
    await this.tenantRepository.save(tenant);

    const users = await this.userRepository.findByTenantId(subscription.tenantId);
    const owner =
      users.find((u) => u.role === 'OWNER') ?? users[0] ?? null;

    return {
      userId: owner?.id ?? '',
      onboardingStatus: tenant.onboardingStatus,
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

    const onboardingStatus = await this.ensureTenantStatusAtLeast(
      user.tenantId,
      OnboardingStatus.PENDING_STORE_ROLE,
    );

    return { store: saved, onboardingStatus };
  }

  /**
   * Confirma una tienda ya conectada y avanza el onboarding a
   * PENDING_STORE_ROLE si el tenant todavía estaba en STORE_CONFIG.
   * Usado cuando el usuario vuelve al paso 3 y continúa sin reingresar token.
   */
  async confirmStore(userId: string): Promise<{
    store: Store;
    onboardingStatus: OnboardingStatus;
  }> {
    const user = await this.requireStatus(
      userId,
      OnboardingStatus.PENDING_STORE_CONFIG,
    );

    if (!user.tenantId) {
      throw new BadRequestException('Tenant requerido');
    }

    const stores = await this.storeRepository.findByTenantId(user.tenantId);
    const store = stores[0];
    if (!store) {
      throw new BadRequestException(
        'No hay una tienda conectada. Completá el formulario para vincularla.',
      );
    }

    const onboardingStatus = await this.ensureTenantStatusAtLeast(
      user.tenantId,
      OnboardingStatus.PENDING_STORE_ROLE,
    );

    return { store, onboardingStatus };
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

    const onboardingStatus = await this.ensureTenantStatusAtLeast(
      user.tenantId,
      OnboardingStatus.PENDING_TEAM_CONFIG,
    );

    return { store: saved, onboardingStatus };
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
  ): Promise<{
    member: import('../../domain/entities/team_member.entity').TeamInvitation;
  }> {
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

    const tenant = await this.tenantRepository.findById(user.tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    tenant.onboardingStatus = OnboardingStatus.COMPLETED;
    tenant.status = TenantStatus.ACTIVE;
    await this.tenantRepository.save(tenant);

    return { onboardingStatus: tenant.onboardingStatus };
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

  private async getTenantOnboardingStatus(
    user: User,
  ): Promise<OnboardingStatus> {
    if (!user.tenantId) {
      return OnboardingStatus.PENDING_TENANT_CONFIG;
    }
    const tenant = await this.tenantRepository.findById(user.tenantId);
    return tenant?.onboardingStatus ?? OnboardingStatus.PENDING_TENANT_CONFIG;
  }

  private async advanceTenantStatus(
    tenant: Tenant,
    from: OnboardingStatus,
    to: OnboardingStatus,
  ): Promise<OnboardingStatus> {
    if (tenant.onboardingStatus === from) {
      tenant.onboardingStatus = to;
      await this.tenantRepository.save(tenant);
    }
    return tenant.onboardingStatus;
  }

  /**
   * Avanza el status del tenant hacia `minStatus` si todavía está atrás.
   * No retrocede si el tenant ya pasó ese paso.
   */
  private async ensureTenantStatusAtLeast(
    tenantId: string,
    minStatus: OnboardingStatus,
  ): Promise<OnboardingStatus> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    const currentStep = ONBOARDING_STATUS_TO_STEP[tenant.onboardingStatus];
    const minStep = ONBOARDING_STATUS_TO_STEP[minStatus];
    if (currentStep < minStep) {
      tenant.onboardingStatus = minStatus;
      await this.tenantRepository.save(tenant);
    }

    return tenant.onboardingStatus;
  }

  private async advanceTenantByUser(
    user: User,
    from: OnboardingStatus,
    to: OnboardingStatus,
  ): Promise<OnboardingStatus> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant requerido');
    }
    const tenant = await this.tenantRepository.findById(user.tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }
    return this.advanceTenantStatus(tenant, from, to);
  }

  private async requireStatus(
    userId: string,
    expected: OnboardingStatus,
  ): Promise<User> {
    return this.requireStepReachable(userId, expected);
  }

  /**
   * Permite editar un step si el TENANT está en ese step o ya lo superó.
   * Falla con 409 solo si intenta editar un step al que todavía no llegó.
   */
  private async requireStepReachable(
    userId: string,
    expected: OnboardingStatus,
  ): Promise<User> {
    const user = await this.getUser(userId);
    const currentStatus = await this.getTenantOnboardingStatus(user);
    if (currentStatus === OnboardingStatus.COMPLETED) {
      return user;
    }
    const currentStep = ONBOARDING_STATUS_TO_STEP[currentStatus];
    const targetStep = ONBOARDING_STATUS_TO_STEP[expected];
    if (currentStep < targetStep) {
      throw new ConflictException({
        message: `Estado de onboarding inválido. Esperado: ${expected}, actual: ${currentStatus}`,
        current: currentStatus,
        expected,
      });
    }
    return user;
  }
}
