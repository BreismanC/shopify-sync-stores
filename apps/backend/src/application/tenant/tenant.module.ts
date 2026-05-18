import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../domain/entities/tenant.entity';
import { ITenantRepository } from './repositories/ITenantRepository';
import { TypeORMTenantRepository } from '../../infrastructure/repositories/tenant/TypeORMTenantRepository';
import { TenantService } from './tenant.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [
    {
      provide: ITenantRepository,
      useClass: TypeORMTenantRepository,
    },
    TenantService,
  ],
  exports: [ITenantRepository, TenantService],
})
export class TenantModule {}
