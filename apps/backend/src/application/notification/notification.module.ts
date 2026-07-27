import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../domain/entities/notification.entity';
import { TypeOrmNotificationRepository } from '../../infrastructure/repositories/notification/typeorm-notification.repository';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import {
  CreateNotificationUseCase,
  GetNotificationsUseCase,
  UpdateNotificationUseCase,
} from './notification.use-cases';
import { NotificationController } from './notification.controller';
import { INotificationRepository } from './repositories/notification.repository';
import { RealtimeModule } from '../../infrastructure/realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    AuthModule,
    TenantModule,
    RealtimeModule,
  ],
  controllers: [NotificationController],
  providers: [
    TypeOrmNotificationRepository,
    {
      provide: INotificationRepository,
      useExisting: TypeOrmNotificationRepository,
    },
    CreateNotificationUseCase,
    GetNotificationsUseCase,
    UpdateNotificationUseCase,
  ],
  exports: [CreateNotificationUseCase, INotificationRepository],
})
export class NotificationModule {}
