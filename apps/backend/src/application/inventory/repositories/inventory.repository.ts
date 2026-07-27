import { InventoryLocationMapping } from '../../../domain/entities/sync.entity';

export abstract class IInventoryRepository {
  abstract findLocationMapping(
    connectionId: string,
    sourceLocationId: string,
  ): Promise<InventoryLocationMapping | null>;
  abstract listMappings(
    tenantId: string,
    connectionId: string,
  ): Promise<InventoryLocationMapping[]>;
  abstract saveMapping(
    mapping: InventoryLocationMapping,
  ): Promise<InventoryLocationMapping>;
  abstract createMapping(
    input: Partial<InventoryLocationMapping>,
  ): InventoryLocationMapping;
}
