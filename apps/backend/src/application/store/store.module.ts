import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../../domain/entities/store.entity';
import { IStoreRepository } from './repositories/IStoreRepository';
import { TypeORMStoreRepository } from '../../infrastructure/repositories/store/TypeORMStoreRepository';
import { StoreController } from './store.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Store])],
  controllers: [StoreController],
  providers: [
    {
      provide: IStoreRepository,
      useClass: TypeORMStoreRepository,
    },
  ],
  exports: [IStoreRepository],
})
export class StoreModule {}