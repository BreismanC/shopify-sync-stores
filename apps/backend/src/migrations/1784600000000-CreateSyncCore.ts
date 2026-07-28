import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSyncCore1784600000000 implements MigrationInterface {
  name = 'CreateSyncCore1784600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // store_connections_status_enum puede ya existir (creado por CreateInitialSchema
    // o por un reintento). Lo creamos de forma idempotente.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_connections_status_enum') THEN
          CREATE TYPE "store_connections_status_enum" AS ENUM ('PENDING','ACTIVE','REJECTED','REVOKED','CANCELED','EXPIRED');
        END IF;
      END$$;
    `);

    // connectedAt ya viene nullable desde CreateInitialSchema. El bloque se
    // mantiene como red de seguridad para bases migradas desde el esquema
    // anterior (donde connectedAt era NOT NULL).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'store_connections' AND column_name = 'connectedAt' AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE "store_connections" ALTER COLUMN "connectedAt" DROP NOT NULL;
        END IF;
      END$$;
    `);

    // Columnas status, expiresAt y respondedAt también vienen ya desde
    // CreateInitialSchema. Sólo las añadimos si faltan (esquemas viejos).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'store_connections' AND column_name = 'status'
        ) THEN
          ALTER TABLE "store_connections"
            ADD COLUMN "status" "store_connections_status_enum" NOT NULL DEFAULT 'PENDING';
          UPDATE "store_connections"
            SET "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"store_connections_status_enum" ELSE 'REVOKED'::"store_connections_status_enum" END;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'store_connections' AND column_name = 'expiresAt'
        ) THEN
          ALTER TABLE "store_connections" ADD COLUMN "expiresAt" timestamptz NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'store_connections' AND column_name = 'respondedAt'
        ) THEN
          ALTER TABLE "store_connections" ADD COLUMN "respondedAt" timestamptz NULL;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_batches_status_enum') THEN
          CREATE TYPE "sync_batches_status_enum" AS ENUM ('PENDING','RUNNING','COMPLETED','PARTIAL','FAILED','CANCELED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_events_status_enum') THEN
          CREATE TYPE "sync_events_status_enum" AS ENUM ('PENDING','PROCESSING','SUCCEEDED','FAILED','SKIPPED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payouts_status_enum') THEN
          CREATE TYPE "payouts_status_enum" AS ENUM ('PENDING','PAID','CANCELED');
        END IF;
      END$$;
    `);

    await queryRunner.query(
      `CREATE TABLE "product_snapshots" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "storeId" uuid NOT NULL, "shopifyProductId" varchar NOT NULL, "title" varchar NOT NULL, "description" text NULL, "vendor" varchar NULL, "productType" varchar NULL, "tags" jsonb NOT NULL DEFAULT '[]', "status" varchar NOT NULL DEFAULT 'draft', "images" jsonb NOT NULL DEFAULT '[]', "payload" jsonb NOT NULL DEFAULT '{}', "shopifyCreatedAt" timestamptz NULL, "shopifyUpdatedAt" timestamptz NULL, "deletedAt" timestamptz NULL, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_product_snapshot_store_shopify" UNIQUE ("storeId","shopifyProductId"), CONSTRAINT "FK_product_snapshot_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_snapshot_tenant_updated" ON "product_snapshots" ("tenantId","shopifyUpdatedAt")`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_variant_snapshots" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "storeId" uuid NOT NULL, "productId" uuid NOT NULL, "shopifyVariantId" varchar NOT NULL, "shopifyInventoryItemId" varchar NULL, "title" varchar NULL, "sku" varchar NULL, "barcode" varchar NULL, "price" numeric(18,4) NOT NULL DEFAULT 0, "inventoryQuantity" integer NOT NULL DEFAULT 0, "payload" jsonb NOT NULL DEFAULT '{}', "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_product_variant_store_shopify" UNIQUE ("storeId","shopifyVariantId"), CONSTRAINT "FK_product_variant_product" FOREIGN KEY ("productId") REFERENCES "product_snapshots"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_variant_tenant_sku" ON "product_variant_snapshots" ("tenantId","sku")`,
    );

    await queryRunner.query(
      `CREATE TABLE "synced_products" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "connectionId" uuid NOT NULL, "sourceProductId" uuid NOT NULL, "vendorProductId" varchar NOT NULL, "sourceShopifyProductId" varchar NOT NULL, "vendorShopifyProductId" varchar NOT NULL, "lastSourceVersion" varchar NULL, "lastSyncedAt" timestamptz NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_synced_product_connection_source" UNIQUE ("connectionId","sourceProductId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sync_settings" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "connectionId" uuid NULL, "version" integer NOT NULL DEFAULT 1, "productRules" jsonb NOT NULL DEFAULT '{}', "orderRules" jsonb NOT NULL DEFAULT '{}', "inventoryRules" jsonb NOT NULL DEFAULT '{}', "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_sync_settings_tenant_connection" UNIQUE NULLS NOT DISTINCT ("tenantId","connectionId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sync_batches" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "connectionId" uuid NOT NULL, "requestedByUserId" uuid NOT NULL, "status" "sync_batches_status_enum" NOT NULL DEFAULT 'PENDING', "total" integer NOT NULL DEFAULT 0, "processed" integer NOT NULL DEFAULT 0, "succeeded" integer NOT NULL DEFAULT 0, "failed" integer NOT NULL DEFAULT 0, "skipped" integer NOT NULL DEFAULT 0, "summary" jsonb NOT NULL DEFAULT '{}', "startedAt" timestamptz NULL, "finishedAt" timestamptz NULL, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sync_batch_tenant_created" ON "sync_batches" ("tenantId","createdAt")`,
    );
    await queryRunner.query(
      `CREATE TABLE "sync_events" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "batchId" uuid NULL, "connectionId" uuid NULL, "type" varchar NOT NULL, "idempotencyKey" varchar NOT NULL UNIQUE, "status" "sync_events_status_enum" NOT NULL DEFAULT 'PENDING', "payload" jsonb NOT NULL DEFAULT '{}', "error" text NULL, "attempts" integer NOT NULL DEFAULT 0, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sync_event_tenant_created" ON "sync_events" ("tenantId","createdAt")`,
    );
    await queryRunner.query(
      `CREATE TABLE "inventory_location_mappings" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "connectionId" uuid NOT NULL, "sourceLocationId" varchar NOT NULL, "vendorLocationId" varchar NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_inventory_mapping_connection_locations" UNIQUE ("connectionId","sourceLocationId","vendorLocationId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reconciliation_checkpoints" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "storeId" uuid NOT NULL, "module" varchar NOT NULL, "cursor" varchar NULL, "processedThrough" timestamptz NULL, "updatedAt" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_reconciliation_store_module" UNIQUE ("storeId","module"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "synced_orders" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "connectionId" uuid NOT NULL, "vendorStoreId" uuid NOT NULL, "sourceStoreId" uuid NOT NULL, "vendorShopifyOrderId" varchar NOT NULL, "sourceShopifyOrderId" varchar NULL, "status" varchar NOT NULL DEFAULT 'PENDING', "currency" varchar NULL, "subtotal" numeric(18,4) NOT NULL DEFAULT 0, "payload" jsonb NOT NULL DEFAULT '{}', "lastError" text NULL, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_synced_order_connection_vendor_source" UNIQUE ("connectionId","vendorShopifyOrderId","sourceStoreId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_synced_order_tenant_created" ON "synced_orders" ("tenantId","createdAt")`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_line_mappings" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "syncedOrderId" uuid NOT NULL, "vendorLineItemId" varchar NOT NULL, "sourceVariantId" uuid NOT NULL, "sourceLineItemId" varchar NULL, "quantity" integer NOT NULL, "unitPrice" numeric(18,4) NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_order_line_mapping_vendor_line_source" UNIQUE ("syncedOrderId","vendorLineItemId","sourceVariantId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "payouts" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "syncedOrderId" uuid NOT NULL, "sourceTenantId" uuid NOT NULL, "vendorTenantId" uuid NOT NULL, "grossAmount" numeric(18,4) NOT NULL, "commissionAmount" numeric(18,4) NOT NULL, "netAmount" numeric(18,4) NOT NULL, "currency" varchar NOT NULL, "status" "payouts_status_enum" NOT NULL DEFAULT 'PENDING', "paidAt" timestamptz NULL, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payout_tenant_status" ON "payouts" ("tenantId","status")`,
    );

    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "userId" uuid NULL, "type" varchar NOT NULL, "title" varchar NOT NULL, "message" text NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "eventId" varchar NULL, "readAt" timestamptz NULL, "archivedAt" timestamptz NULL, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notification_tenant_event" ON "notifications" ("tenantId","eventId") WHERE "eventId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_tenant_read_created" ON "notifications" ("tenantId","readAt","createdAt")`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_deliveries" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NULL, "shopDomain" varchar NOT NULL, "topic" varchar NOT NULL, "shopifyEventId" varchar NOT NULL, "payloadHash" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'RECEIVED', "payload" jsonb NOT NULL, "triggeredAt" timestamptz NULL, "processedAt" timestamptz NULL, "error" text NULL, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_webhook_shop_event" UNIQUE ("shopDomain","shopifyEventId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_status_created" ON "webhook_deliveries" ("status","createdAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'webhook_deliveries',
      'notifications',
      'payouts',
      'order_line_mappings',
      'synced_orders',
      'reconciliation_checkpoints',
      'inventory_location_mappings',
      'sync_events',
      'sync_batches',
      'sync_settings',
      'synced_products',
      'product_variant_snapshots',
      'product_snapshots',
    ])
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    await queryRunner.query(
      `ALTER TABLE "store_connections" DROP COLUMN IF EXISTS "respondedAt", DROP COLUMN IF EXISTS "expiresAt", DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "payouts_status_enum"; DROP TYPE IF EXISTS "sync_events_status_enum"; DROP TYPE IF EXISTS "sync_batches_status_enum"; DROP TYPE IF EXISTS "store_connections_status_enum"`,
    );
  }
}
