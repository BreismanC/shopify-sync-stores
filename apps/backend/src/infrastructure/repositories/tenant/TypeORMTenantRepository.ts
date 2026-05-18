import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../../domain/entities/tenant.entity';
import { ITenantRepository } from '../../../application/tenant/repositories/ITenantRepository';

@Injectable()
export class TypeORMTenantRepository implements ITenantRepository {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { id } });
  }

  async save(tenant: Tenant): Promise<Tenant> {
    return this.tenantRepository.save(tenant);
  }

  create(tenant: Partial<Tenant>): Tenant {
    return this.tenantRepository.create(tenant);
  }

  async findByName(name: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { name } });
  }
}
