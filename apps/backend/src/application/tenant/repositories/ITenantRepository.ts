import { Tenant } from '../../../domain/entities/tenant.entity';

export const ITenantRepository = 'ITenantRepository';

export interface ITenantRepository {
  findById(id: string): Promise<Tenant | null>;
  save(tenant: Tenant): Promise<Tenant>;
  create(tenant: Partial<Tenant>): Tenant;
  findByName(name: string): Promise<Tenant | null>;
}
