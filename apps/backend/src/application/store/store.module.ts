import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../../domain/entities/store.entity';
import { StoreConnection } from '../../domain/entities/store-connection.entity';
import { StoreWebhook } from '../../domain/entities/store-webhook.entity';
import { IStoreRepository } from './repositories/IStoreRepository';
import { TypeORMStoreRepository } from '../../infrastructure/repositories/store/TypeORMStoreRepository';
import { ISTORE_CONNECTION_REPOSITORY } from './repositories/IStoreConnectionRepository';
import { TypeORMStoreConnectionRepository } from '../../infrastructure/repositories/store/TypeORMStoreConnectionRepository';
import { IStoreWebhookRepository } from './repositories/IStoreWebhookRepository';
import { TypeORMStoreWebhookRepository } from '../../infrastructure/repositories/store/TypeORMStoreWebhookRepository';
import { StoreController } from './store.controller';
import { StoreConnectionService } from './store-connection.service';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../../infrastructure/services/email/email.module';
import { NotificationModule } from '../notification/notification.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, StoreConnection, StoreWebhook]),
    forwardRef(() => AuthModule),
    forwardRef(() => EmailModule),
    NotificationModule,
    forwardRef(() => TenantModule),
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
    {
      provide: IStoreWebhookRepository,
      useClass: TypeORMStoreWebhookRepository,
    },
    StoreConnectionService,
  ],
  exports: [
    IStoreRepository,
    ISTORE_CONNECTION_REPOSITORY,
    IStoreWebhookRepository,
    StoreConnectionService,
  ],
})
export class StoreModule {}
