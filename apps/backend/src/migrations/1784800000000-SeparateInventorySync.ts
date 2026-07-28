import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateInventorySync1784800000000 implements MigrationInterface {
  name = 'SeparateInventorySync1784800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "storeId" uuid NOT NULL,
        "variantId" uuid NOT NULL,
        "inventoryItemId" varchar NOT NULL,
        "availableQuantity" integer NOT NULL DEFAULT 0,
        "shopifyUpdatedAt" timestamptz NULL,
        "lastError" text NULL,
        "lastDurationMs" integer NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_inventory_snapshot_store_item" UNIQUE ("storeId", "inventoryItemId")
      );
      CREATE INDEX IF NOT EXISTS "IDX_inventory_snapshot_variant"
        ON "inventory_snapshots" ("variantId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "variant_syncs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "productSyncId" uuid NOT NULL,
        "connectionId" uuid NOT NULL,
        "sourceStoreId" uuid NOT NULL,
        "vendorStoreId" uuid NOT NULL,
        "sourceVariantId" uuid NOT NULL,
        "vendorVariantId" uuid NOT NULL,
        "sourceInventoryItemId" varchar NULL,
        "vendorInventoryItemId" varchar NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "syncEnabled" boolean NOT NULL DEFAULT true,
        "lastSyncedAt" timestamptz NULL,
        "lastError" text NULL,
        "lastDurationMs" integer NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_variant_sync_connection_source" UNIQUE ("connectionId", "sourceVariantId")
      );
      CREATE INDEX IF NOT EXISTS "IDX_variant_sync_source_variant"
        ON "variant_syncs" ("sourceVariantId");
      CREATE INDEX IF NOT EXISTS "IDX_variant_sync_vendor_variant"
        ON "variant_syncs" ("vendorVariantId");
      CREATE INDEX IF NOT EXISTS "IDX_variant_sync_connection_source"
        ON "variant_syncs" ("connectionId", "sourceVariantId");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_variant_sync_connection_source";
      DROP INDEX IF EXISTS "IDX_variant_sync_vendor_variant";
      DROP INDEX IF EXISTS "IDX_variant_sync_source_variant";
      DROP TABLE IF EXISTS "variant_syncs";
      DROP INDEX IF EXISTS "IDX_inventory_snapshot_variant";
      DROP TABLE IF EXISTS "inventory_snapshots";
    `);
  }
}
