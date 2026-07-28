import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  ITenantRepository,
} from './repositories/ITenantRepository';
import {
  IUSER_REPOSITORY,
  IUserRepository,
} from '../auth/repositories/IUserRepository';
import {
  ITENANT_MEMBERSHIP_REPOSITORY,
} from './repositories/ITenantMembershipRepository';
import type { ITenantMembershipRepository } from './repositories/ITenantMembershipRepository';
import type { Tenant } from '../../domain/entities/tenant.entity';
import type { TenantMembership } from '../../domain/entities/tenant-membership.entity';
import { MembershipStatus } from '../../domain/enums/membership-status.enum';
import { UserRole } from '../../domain/enums/user-role.enum';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @Inject(ITenantRepository)
    private readonly tenantRepository: ITenantRepository,
    @Inject(IUSER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(ITENANT_MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: ITenantMembershipRepository,
  ) {}

  async create(name: string): Promise<Tenant> {
    const tenant = this.tenantRepository.create({
      name,
    });
    return this.tenantRepository.save(tenant);
  }

  /**
   * Garantiza que exista una membresía activa para `(userId, tenantId)`. Si
   * ya existe, la reactiva; si no, la crea usando el rol del usuario (o
   * OWNER si el usuario no tiene rol asignado).
   *
   * Es idempotente: puede invocarse en cualquier flujo que asocie un usuario
   * a un tenant (registro, onboarding, invitaciones futuras).
   */
  /**
   * Variante pública de `ensureMembership` para que otros servicios
   * (registro, invitaciones) puedan garantizar la membresía sin duplicar
   * la lógica de `upsertTenant`.
   */
  async syncMembership(
    userId: string,
    tenantId: string,
    role: UserRole,
  ): Promise<TenantMembership> {
    return this.ensureMembership(userId, tenantId, role);
  }

  /**
   * Revoca la membresía de un usuario en un tenant. Idempotente: si no hay
   * membresía o ya estaba revocada, no hace nada.
   */
  async revokeMembership(userId: string, tenantId: string): Promise<void> {
    const existing = await this.membershipRepository.findAny(userId, tenantId);
    if (!existing || existing.status === MembershipStatus.REVOKED) {
      return;
    }
    existing.status = MembershipStatus.REVOKED;
    await this.membershipRepository.save(existing);
  }

  private async ensureMembership(
    userId: string,
    tenantId: string,
    role: UserRole,
  ): Promise<TenantMembership> {
    const existing = await this.membershipRepository.findAny(userId, tenantId);
    if (existing) {
      const needsUpdate =
        existing.role !== role || existing.status !== MembershipStatus.ACTIVE;
      if (needsUpdate) {
        existing.role = role;
        existing.status = MembershipStatus.ACTIVE;
        return this.membershipRepository.save(existing);
      }
      return existing;
    }
    const created = this.membershipRepository.create({
      userId,
      tenantId,
      role,
    });
    return this.membershipRepository.save(created);
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findById(id);
  }

  async findByName(name: string): Promise<Tenant | null> {
    return this.tenantRepository.findByName(name);
  }

  async upsertTenant(userId: string, tenantName: string): Promise<Tenant> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const existingTenantId = user.tenantId;
    if (existingTenantId) {
      // Ya tiene tenant - actualizar nombre. La membresía ya existe (se creó
      // al asignar el tenant originalmente); sólo nos aseguramos de que
      // siga activa.
      const tenant = await this.findById(existingTenantId);
      if (tenant) {
        tenant.name = tenantName;
        return this.tenantRepository.save(tenant);
      }
    }

    // No tiene tenant - crear nuevo
    const tenant = await this.create(tenantName);

    // Actualizar el tenantId del usuario
    user.tenantId = tenant.id;
    await this.userRepository.save(user);

    // Crear la membresía activa. Sin esta fila, TenantMembershipGuard
    // rechazaría cualquier request posterior del usuario contra el tenant.
    try {
      await this.ensureMembership(
        userId,
        tenant.id,
        user.role ?? UserRole.OWNER,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo crear la membresía inicial para user=${userId} tenant=${tenant.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }

    return tenant;
  }

  async requireMembership(
    userId: string,
    tenantId: string,
  ): Promise<TenantMembership> {
    const membership = await this.membershipRepository.findActive(
      userId,
      tenantId,
    );
    if (!membership) {
      throw new Error(
        `El usuario ${userId} no pertenece al tenant ${tenantId}.`,
      );
    }
    return membership;
  }
}
