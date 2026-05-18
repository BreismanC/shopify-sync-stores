import { Tenant } from '../../../domain/entities/tenant.entity';

export abstract class ITenantRepository {
  abstract findById(id: string): Promise<Tenant | null>;
  abstract save(tenant: Tenant): Promise<Tenant>;
  abstract create(tenant: Partial<Tenant>): Tenant;
  abstract findByName(name: string): Promise<Tenant | null>;
}
