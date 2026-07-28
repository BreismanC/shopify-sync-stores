import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../domain/entities/tenant.entity';
import { TenantMembership } from '../../domain/entities/tenant-membership.entity';
import { ITenantRepository } from './repositories/ITenantRepository';
import { TypeORMTenantRepository } from '../../infrastructure/repositories/tenant/TypeORMTenantRepository';
import {
  ITENANT_MEMBERSHIP_REPOSITORY,
} from './repositories/ITenantMembershipRepository';
import { TypeORMTenantMembershipRepository } from '../../infrastructure/repositories/tenant/TypeORMTenantMembershipRepository';
import { TenantService } from './tenant.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, TenantMembership]),
    forwardRef(() => AuthModule),
  ],
  providers: [
    {
      provide: ITenantRepository,
      useClass: TypeORMTenantRepository,
    },
    {
      provide: ITENANT_MEMBERSHIP_REPOSITORY,
      useClass: TypeORMTenantMembershipRepository,
    },
    TenantService,
  ],
  exports: [ITenantRepository, ITENANT_MEMBERSHIP_REPOSITORY, TenantService],
})
export class TenantModule {}
