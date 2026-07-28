import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  ManyToOne,
} from 'typeorm';
import { Store } from './store.entity';
import {
  WebhookStatus,
  WebhookTopic,
} from '../enums/webhook-topic.enum';

/**
 * Estado local de cada webhook que el sistema intenta registrar contra
 * Shopify para una tienda.
 *
 * Una fila por par `(storeId, topic)`. El `callbackUrl` se persiste para
 * detectar cuando cambia (rotación del BACKEND_PUBLIC_URL) y re-registrar
 * la suscripción.
 */
@Entity('store_webhooks')
@Unique('UQ_store_webhooks_store_topic', ['storeId', 'topic'])
@Index('IDX_store_webhooks_store', ['storeId'])
@Index('IDX_store_webhooks_status', ['status'])
export class StoreWebhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  store: Store;

  /**
   * Tópico Shopify. Usamos varchar para que añadir un nuevo valor al enum
   * no requiera una migración de tipo de columna.
   */
  @Column({ type: 'varchar', length: 64 })
  topic: WebhookTopic;

  /** URL completa a la que Shopify enviará los eventos. */
  @Column({ type: 'varchar', length: 512 })
  callbackUrl: string;

  /**
   * GID interno que Shopify asignó a la suscripción
   * (`gid://shopify/WebhookSubscription/...`). Null cuando todavía no
   * estamos conectados o cuando Shopify devolvió `null`.
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  shopifyWebhookId: string | null;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.PENDING,
  })
  status: WebhookStatus;

  /** Mensaje de error cuando `status === FAILED`. */
  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  /**
   * Cantidad de reintentos fallidos consecutivos. Útil para depurar y para
   * decidir si reintentar automáticamente.
   */
  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Última vez que intentamos registrar/refrescar el webhook. */
  @Column({ type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
