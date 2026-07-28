import {
  InventorySnapshot,
  VariantSync,
} from '../../../domain/entities/sync.entity';

export abstract class IInventoryRepository {
  abstract findSnapshotByInventoryItem(
    storeId: string,
    inventoryItemId: string,
  ): Promise<InventorySnapshot | null>;
  abstract findSnapshotsByVariantIds(
    variantIds: string[],
  ): Promise<InventorySnapshot[]>;
  abstract createSnapshot(input: Partial<InventorySnapshot>): InventorySnapshot;
  abstract saveSnapshot(
    snapshot: InventorySnapshot,
  ): Promise<InventorySnapshot>;
  abstract findVariantSync(
    connectionId: string,
    sourceVariantId: string,
  ): Promise<VariantSync | null>;
  abstract findActiveVariantSyncsBySourceVariant(
    sourceVariantId: string,
  ): Promise<VariantSync[]>;
  abstract createVariantSync(input: Partial<VariantSync>): VariantSync;
  abstract saveVariantSync(sync: VariantSync): Promise<VariantSync>;
}
