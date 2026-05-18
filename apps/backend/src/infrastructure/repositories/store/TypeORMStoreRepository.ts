import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../../../domain/entities/store.entity';
import { IStoreRepository } from '../../../application/store/repositories/IStoreRepository';

@Injectable()
export class TypeORMStoreRepository implements IStoreRepository {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  async findByShopId(shopifyShopId: string): Promise<Store | null> {
    return this.storeRepository.findOne({ where: { shopifyShopId } });
  }

  async findByTenantId(tenantId: string): Promise<Store[]> {
    return this.storeRepository.find({ where: { tenantId } });
  }

  async save(store: Store): Promise<Store> {
    return this.storeRepository.save(store);
  }

  create(store: Partial<Store>): Store {
    return this.storeRepository.create(store);
  }
}
