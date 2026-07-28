import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  InventorySnapshot,
  VariantSync,
} from '../../../domain/entities/sync.entity';
import { IInventoryRepository } from '../../../application/inventory/repositories/inventory.repository';

@Injectable()
export class TypeOrmInventoryRepository implements IInventoryRepository {
  constructor(
    @InjectRepository(InventorySnapshot)
    private readonly snapshots: Repository<InventorySnapshot>,
    @InjectRepository(VariantSync)
    private readonly variantSyncs: Repository<VariantSync>,
  ) {}

  findSnapshotByInventoryItem(storeId: string, inventoryItemId: string) {
    return this.snapshots.findOne({
      where: { storeId, inventoryItemId },
    });
  }

  findSnapshotsByVariantIds(variantIds: string[]) {
    if (!variantIds.length) return Promise.resolve([]);
    return this.snapshots.find({ where: { variantId: In(variantIds) } });
  }

  createSnapshot(input: Partial<InventorySnapshot>) {
    return this.snapshots.create(input);
  }

  saveSnapshot(snapshot: InventorySnapshot) {
    return this.snapshots.save(snapshot);
  }

  findVariantSync(connectionId: string, sourceVariantId: string) {
    return this.variantSyncs.findOne({
      where: { connectionId, sourceVariantId },
    });
  }

  findActiveVariantSyncsBySourceVariant(sourceVariantId: string) {
    return this.variantSyncs.find({
      where: {
        sourceVariantId,
        syncEnabled: true,
      },
    });
  }

  createVariantSync(input: Partial<VariantSync>) {
    return this.variantSyncs.create(input);
  }

  saveVariantSync(sync: VariantSync) {
    return this.variantSyncs.save(sync);
  }
}
