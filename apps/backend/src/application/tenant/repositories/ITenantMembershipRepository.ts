import { TenantMembership } from '../../../domain/entities/tenant-membership.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';

export const ITENANT_MEMBERSHIP_REPOSITORY = Symbol(
  'ITENANT_MEMBERSHIP_REPOSITORY',
);

export interface CreateTenantMembershipInput {
  userId: string;
  tenantId: string;
  role: UserRole;
}

export interface ITenantMembershipRepository {
  findActiveByUserId(userId: string): Promise<TenantMembership[]>;
  findActive(
    userId: string,
    tenantId: string,
  ): Promise<TenantMembership | null>;
  findByTenantId(tenantId: string): Promise<TenantMembership[]>;
  create(input: CreateTenantMembershipInput): TenantMembership;
  save(membership: TenantMembership): Promise<TenantMembership>;
}
