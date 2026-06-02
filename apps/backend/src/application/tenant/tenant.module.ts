import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../domain/entities/tenant.entity';
import { ITenantRepository } from './repositories/ITenantRepository';
import { TypeORMTenantRepository } from '../../infrastructure/repositories/tenant/TypeORMTenantRepository';
import { TenantService } from './tenant.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), forwardRef(() => AuthModule)],
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
