import { Injectable } from '@nestjs/common';
import { ITenantRepository } from './repositories/ITenantRepository';
import { Tenant } from '../../domain/entities/tenant.entity';

@Injectable()
export class TenantService {
  constructor(private readonly tenantRepository: ITenantRepository) {}

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
}
