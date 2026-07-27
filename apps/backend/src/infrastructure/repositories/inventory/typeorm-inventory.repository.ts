import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryLocationMapping } from '../../../domain/entities/sync.entity';
import { IInventoryRepository } from '../../../application/inventory/repositories/inventory.repository';

@Injectable()
export class TypeOrmInventoryRepository implements IInventoryRepository {
  constructor(
    @InjectRepository(InventoryLocationMapping)
    private readonly repository: Repository<InventoryLocationMapping>,
  ) {}
  findLocationMapping(connectionId: string, sourceLocationId: string) {
    return this.repository.findOne({
      where: { connectionId, sourceLocationId, isActive: true },
    });
  }
  listMappings(tenantId: string, connectionId: string) {
    return this.repository.find({ where: { tenantId, connectionId } });
  }
  saveMapping(mapping: InventoryLocationMapping) {
    return this.repository.save(mapping);
  }
  createMapping(input: Partial<InventoryLocationMapping>) {
    return this.repository.create(input);
  }
}
