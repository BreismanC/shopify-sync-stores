import { Injectable, Inject } from '@nestjs/common';
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

@Injectable()
export class TenantService {
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
      // Ya tiene tenant - actualizar nombre
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
