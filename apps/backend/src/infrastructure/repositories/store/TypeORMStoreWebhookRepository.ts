import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreWebhook } from '../../../domain/entities/store-webhook.entity';
import {
  IStoreWebhookRepository,
  StoreWebhookRow,
  UpsertStoreWebhookInput,
} from '../../../application/store/repositories/IStoreWebhookRepository';
import {
  WebhookStatus,
  WebhookTopic,
} from '../../../domain/enums/webhook-topic.enum';

@Injectable()
export class TypeORMStoreWebhookRepository implements IStoreWebhookRepository {
  constructor(
    @InjectRepository(StoreWebhook)
    private readonly repository: Repository<StoreWebhook>,
  ) {}

  async listByStore(storeId: string): Promise<StoreWebhookRow[]> {
    const rows = await this.repository.find({
      where: { storeId },
      order: { topic: 'ASC' },
    });
    return rows.map((r) => this.toRow(r));
  }

  async upsert(input: UpsertStoreWebhookInput): Promise<StoreWebhookRow> {
    const existing = await this.repository.findOne({
      where: { storeId: input.storeId, topic: input.topic },
    });
    const entity =
      existing ??
      this.repository.create({
        storeId: input.storeId,
        topic: input.topic,
        callbackUrl: input.callbackUrl,
      });
    entity.callbackUrl = input.callbackUrl;
    entity.shopifyWebhookId = input.shopifyWebhookId;
    entity.status = input.status;
    entity.lastError = input.lastError;
    entity.attempts = input.attempts;
    entity.lastAttemptAt = input.lastAttemptAt;
    const saved = await this.repository.save(entity);
    return this.toRow(saved);
  }

  async deleteByStore(storeId: string): Promise<void> {
    await this.repository.delete({ storeId });
  }

  async countByStoreAndStatus(
    storeId: string,
    status: WebhookStatus,
  ): Promise<number> {
    return this.repository.count({ where: { storeId, status } });
  }

  private toRow(entity: StoreWebhook): StoreWebhookRow {
    return {
      id: entity.id,
      storeId: entity.storeId,
      topic: entity.topic as WebhookTopic,
      callbackUrl: entity.callbackUrl,
      shopifyWebhookId: entity.shopifyWebhookId,
      status: entity.status as WebhookStatus,
      lastError: entity.lastError,
      attempts: entity.attempts,
      lastAttemptAt: entity.lastAttemptAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
