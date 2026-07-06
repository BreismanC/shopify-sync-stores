import { Repository, EntityManager, ObjectLiteral } from 'typeorm';
import { getEntityManager } from '../typeorm.config';

export abstract class BaseRepository<T extends ObjectLiteral> {
  protected abstract readonly entityClass: new () => T;

  protected get manager(): EntityManager {
    return getEntityManager();
  }

  protected get repository(): Repository<T> {
    return this.manager.getRepository(this.entityClass);
  }

  async findOne(where: Partial<T>): Promise<T | null> {
    return this.repository.findOne({ where: where as any });
  }

  async findMany(where: Partial<T>): Promise<T[]> {
    return this.repository.find({ where: where as any });
  }

  async save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    await this.repository.update(id, data as any);
  }

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as any });
  }
}