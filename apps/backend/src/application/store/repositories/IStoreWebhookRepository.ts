import {
  WebhookStatus,
  WebhookTopic,
} from '../../../domain/enums/webhook-topic.enum';

export interface StoreWebhookRow {
  id: string;
  storeId: string;
  topic: WebhookTopic;
  callbackUrl: string;
  shopifyWebhookId: string | null;
  status: WebhookStatus;
  lastError: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertStoreWebhookInput {
  storeId: string;
  topic: WebhookTopic;
  callbackUrl: string;
  shopifyWebhookId: string | null;
  status: WebhookStatus;
  lastError: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
}

/**
 * Puerto de acceso a `store_webhooks`. Definido como abstract class para
 * poder inyectarlo por token (igual que el resto de los puertos de la
 * capa de aplicación).
 */
export abstract class IStoreWebhookRepository {
  abstract listByStore(storeId: string): Promise<StoreWebhookRow[]>;
  abstract upsert(input: UpsertStoreWebhookInput): Promise<StoreWebhookRow>;
  abstract deleteByStore(storeId: string): Promise<void>;
  abstract countByStoreAndStatus(
    storeId: string,
    status: WebhookStatus,
  ): Promise<number>;
}
