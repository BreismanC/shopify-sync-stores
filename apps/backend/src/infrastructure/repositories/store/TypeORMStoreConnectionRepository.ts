import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { StoreConnection } from '../../../domain/entities/store-connection.entity';
import {
  IStoreConnectionRepository,
  ListConnectionsOptions,
  StoreConnectionListItem,
} from '../../../application/store/repositories/IStoreConnectionRepository';

@Injectable()
export class TypeORMStoreConnectionRepository implements IStoreConnectionRepository {
  constructor(
    @InjectRepository(StoreConnection)
    private readonly repository: Repository<StoreConnection>,
  ) {}

  findById(id: string): Promise<StoreConnection | null> {
    return this.repository.findOne({ where: { id } });
  }

  findPair(
    sourceStoreId: string,
    vendorStoreId: string,
  ): Promise<StoreConnection | null> {
    return this.repository.findOne({
      where: { sourceStoreId, vendorStoreId },
    });
  }

  create(connection: Partial<StoreConnection>): StoreConnection {
    return this.repository.create(connection);
  }

  save(connection: StoreConnection): Promise<StoreConnection> {
    return this.repository.save(connection);
  }

  async findConnectedByStore(
    storeId: string,
    options: ListConnectionsOptions,
  ): Promise<{ data: StoreConnectionListItem[]; total: number }> {
    const qb = this.repository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.sourceStore', 'sourceStore')
      .leftJoinAndSelect('c.vendorStore', 'vendorStore')
      .where(
        new Brackets((qb1) => {
          qb1
            .where('c.sourceStoreId = :storeId', { storeId })
            .orWhere('c.vendorStoreId = :storeId', { storeId });
        }),
      );

    if (options.search) {
      qb.andWhere(
        new Brackets((qb2) => {
          qb2
            .where('LOWER(sourceStore.shopifyShopId) LIKE LOWER(:search)', {
              search: `%${options.search}%`,
            })
            .orWhere('LOWER(vendorStore.shopifyShopId) LIKE LOWER(:search)', {
              search: `%${options.search}%`,
            });
        }),
      );
    }

    const sortField =
      options.sortBy === 'isActive' ? 'c.isActive' : 'c.connectedAt';

    qb.orderBy(sortField, options.order.toUpperCase() as 'ASC' | 'DESC')
      .skip((options.page - 1) * options.perPage)
      .take(options.perPage);

    const rows = await qb.getMany();
    const totalQb = this.repository.createQueryBuilder('c').where(
      new Brackets((qb1) => {
        qb1
          .where('c.sourceStoreId = :storeId', { storeId })
          .orWhere('c.vendorStoreId = :storeId', { storeId });
      }),
    );
    if (options.search) {
      totalQb
        .leftJoin('c.sourceStore', 'sourceStore')
        .leftJoin('c.vendorStore', 'vendorStore');
      totalQb.andWhere(
        new Brackets((qb2) => {
          qb2
            .where('LOWER(sourceStore.shopifyShopId) LIKE LOWER(:search)', {
              search: `%${options.search}%`,
            })
            .orWhere('LOWER(vendorStore.shopifyShopId) LIKE LOWER(:search)', {
              search: `%${options.search}%`,
            });
        }),
      );
    }
    const total = await totalQb.getCount();

    const data: StoreConnectionListItem[] = rows.flatMap((c) => {
      const sourceIsSelf = c.sourceStoreId === storeId;
      const peerStore = sourceIsSelf ? c.vendorStore : c.sourceStore;
      const role: 'SOURCE' | 'VENDOR' = sourceIsSelf ? 'VENDOR' : 'SOURCE';
      if (!peerStore) return [];
      return [
        {
          id: c.id,
          storeId: peerStore.id,
          shopifyShopId: peerStore.shopifyShopId,
          role,
          isActive: c.isActive,
          connectedAt: c.connectedAt,
          disconnectedAt: c.disconnectedAt,
        },
      ];
    });

    return { data, total };
  }

  async findAccessibleByStore(
    storeId: string,
    connectionId: string,
  ): Promise<StoreConnection | null> {
    return this.repository
      .createQueryBuilder('c')
      .where('c.id = :id', { id: connectionId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('c.sourceStoreId = :storeId', { storeId }).orWhere(
            'c.vendorStoreId = :storeId',
            { storeId },
          );
        }),
      )
      .getOne();
  }

  async hasActiveConnection(
    storeId: string,
    connectionId: string,
  ): Promise<boolean> {
    const count = await this.repository
      .createQueryBuilder('c')
      .where('c.id = :id', { id: connectionId })
      .andWhere('c.isActive = true')
      .andWhere(
        new Brackets((qb) => {
          qb.where('c.sourceStoreId = :storeId', { storeId }).orWhere(
            'c.vendorStoreId = :storeId',
            { storeId },
          );
        }),
      )
      .getCount();
    return count > 0;
  }
}
