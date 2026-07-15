import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../../domain/entities/store.entity';
import { StoreConnection } from '../../domain/entities/store-connection.entity';
import { IStoreRepository } from './repositories/IStoreRepository';
import { TypeORMStoreRepository } from '../../infrastructure/repositories/store/TypeORMStoreRepository';
import { ISTORE_CONNECTION_REPOSITORY } from './repositories/IStoreConnectionRepository';
import { TypeORMStoreConnectionRepository } from '../../infrastructure/repositories/store/TypeORMStoreConnectionRepository';
import { StoreController } from './store.controller';
import { StoreConnectionService } from './store-connection.service';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../../infrastructure/services/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, StoreConnection]),
    forwardRef(() => AuthModule),
    forwardRef(() => EmailModule),
  ],
  controllers: [StoreController],
  providers: [
    {
      provide: IStoreRepository,
      useClass: TypeORMStoreRepository,
    },
    {
      provide: ISTORE_CONNECTION_REPOSITORY,
      useClass: TypeORMStoreConnectionRepository,
    },
    StoreConnectionService,
  ],
  exports: [
    IStoreRepository,
    ISTORE_CONNECTION_REPOSITORY,
    StoreConnectionService,
  ],
})
export class StoreModule {}
