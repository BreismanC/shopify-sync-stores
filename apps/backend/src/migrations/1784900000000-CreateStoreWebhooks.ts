import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla `store_webhooks` para persistir el estado del registro de
 * webhooks de Shopify por tienda + topic. Permite consultar el estado real
 * (CONNECTED/FAILED) sin pegarle a la API de Shopify y emitir eventos
 * realtime al frontend durante el onboarding del paso 3.
 */
export class CreateStoreWebhooks1784900000000 implements MigrationInterface {
  name = 'CreateStoreWebhooks1784900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "store_webhooks_status_enum" AS ENUM (
        'PENDING',
        'CONNECTED',
        'REGISTERED_WITHOUT_ID',
        'FAILED'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_webhooks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "storeId" uuid NOT NULL,
        "topic" varchar(64) NOT NULL,
        "callbackUrl" varchar(512) NOT NULL,
        "shopifyWebhookId" varchar(128) NULL,
        "status" "store_webhooks_status_enum" NOT NULL DEFAULT 'PENDING',
        "lastError" text NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "lastAttemptAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_store_webhooks_store_topic" UNIQUE ("storeId", "topic"),
        CONSTRAINT "FK_store_webhooks_store"
          FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_webhooks_store"
        ON "store_webhooks" ("storeId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_webhooks_status"
        ON "store_webhooks" ("status");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_store_webhooks_status";
      DROP INDEX IF EXISTS "IDX_store_webhooks_store";
      DROP TABLE IF EXISTS "store_webhooks";
      DROP TYPE IF EXISTS "store_webhooks_status_enum";
    `);
  }
}
