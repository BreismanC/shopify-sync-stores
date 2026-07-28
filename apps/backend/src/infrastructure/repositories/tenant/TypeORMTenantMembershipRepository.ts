import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantMembership } from '../../../domain/entities/tenant-membership.entity';
import { MembershipStatus } from '../../../domain/enums/membership-status.enum';
import {
  CreateTenantMembershipInput,
  ITenantMembershipRepository,
} from '../../../application/tenant/repositories/ITenantMembershipRepository';

@Injectable()
export class TypeORMTenantMembershipRepository implements ITenantMembershipRepository {
  constructor(
    @InjectRepository(TenantMembership)
    private readonly repository: Repository<TenantMembership>,
  ) {}

  findActiveByUserId(userId: string): Promise<TenantMembership[]> {
    return this.repository.find({
      where: { userId, status: MembershipStatus.ACTIVE },
      relations: { tenant: true },
      order: { createdAt: 'ASC' },
    });
  }

  findActive(
    userId: string,
    tenantId: string,
  ): Promise<TenantMembership | null> {
    return this.repository.findOne({
      where: { userId, tenantId, status: MembershipStatus.ACTIVE },
      relations: { tenant: true },
    });
  }

  findAny(
    userId: string,
    tenantId: string,
  ): Promise<TenantMembership | null> {
    return this.repository.findOne({
      where: { userId, tenantId },
      relations: { tenant: true },
    });
  }

  findByTenantId(tenantId: string): Promise<TenantMembership[]> {
    return this.repository.find({
      where: { tenantId, status: MembershipStatus.ACTIVE },
      relations: { user: true },
    });
  }

  create(input: CreateTenantMembershipInput): TenantMembership {
    return this.repository.create({
      ...input,
      status: MembershipStatus.ACTIVE,
    });
  }

  save(membership: TenantMembership): Promise<TenantMembership> {
    return this.repository.save(membership);
  }
}
