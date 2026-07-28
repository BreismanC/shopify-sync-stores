import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignProductSyncPipeline1784700000000 implements MigrationInterface {
  name = 'AlignProductSyncPipeline1784700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'sync_batches_operation_enum'
        ) THEN
          CREATE TYPE "sync_batches_operation_enum"
            AS ENUM ('CATALOG_REFRESH', 'PRODUCT_REPLICATION');
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_batches"
        ALTER COLUMN "connectionId" DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS "sourceStoreId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "destinationStoreId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "operation"
          "sync_batches_operation_enum" NULL;

      UPDATE "sync_batches" b
      SET "sourceStoreId" = c."sourceStoreId",
          "destinationStoreId" = c."vendorStoreId"
      FROM "store_connections" c
      WHERE b."connectionId" = c.id
        AND (b."sourceStoreId" IS NULL OR b."destinationStoreId" IS NULL);

      UPDATE "sync_batches" b
      SET "sourceStoreId" = COALESCE(
            b."sourceStoreId",
            (SELECT s.id FROM stores s
             WHERE s."tenantId" = b."tenantId"
             ORDER BY s."createdAt" ASC LIMIT 1)
          ),
          "destinationStoreId" = COALESCE(
            b."destinationStoreId",
            (SELECT s.id FROM stores s
             WHERE s."tenantId" = b."tenantId"
             ORDER BY s."createdAt" ASC LIMIT 1)
          )
      WHERE b."sourceStoreId" IS NULL OR b."destinationStoreId" IS NULL;

      UPDATE "sync_batches"
      SET "operation" = CASE
        WHEN "connectionId" IS NULL
          THEN 'CATALOG_REFRESH'::"sync_batches_operation_enum"
        ELSE 'PRODUCT_REPLICATION'::"sync_batches_operation_enum"
      END
      WHERE "operation" IS NULL;

      ALTER TABLE "sync_batches"
        ALTER COLUMN "operation" SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "synced_products"
        ADD COLUMN IF NOT EXISTS "sourceStoreId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "vendorStoreId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS "syncEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "lastError" text NULL,
        ADD COLUMN IF NOT EXISTS "lastDurationMs" integer NULL;

      UPDATE "synced_products" p
      SET "sourceStoreId" = c."sourceStoreId",
          "vendorStoreId" = c."vendorStoreId"
      FROM "store_connections" c
      WHERE p."connectionId" = c.id
        AND (p."sourceStoreId" IS NULL OR p."vendorStoreId" IS NULL);

      CREATE INDEX IF NOT EXISTS "IDX_synced_product_source"
        ON "synced_products" ("sourceStoreId", "sourceProductId");
      CREATE INDEX IF NOT EXISTS "IDX_synced_product_vendor"
        ON "synced_products" ("vendorStoreId", "vendorProductId");
      CREATE INDEX IF NOT EXISTS "IDX_synced_product_status"
        ON "synced_products" ("status", "syncEnabled");

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM "synced_products"
          WHERE "sourceStoreId" IS NULL OR "vendorStoreId" IS NULL
        ) THEN
          ALTER TABLE "synced_products"
            ALTER COLUMN "sourceStoreId" SET NOT NULL,
            ALTER COLUMN "vendorStoreId" SET NOT NULL;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "initial_sync_jobs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "storeId" uuid NOT NULL,
        "status" "sync_batches_status_enum" NOT NULL DEFAULT 'PENDING',
        "totalProducts" integer NOT NULL DEFAULT 0,
        "processedProducts" integer NOT NULL DEFAULT 0,
        "succeededProducts" integer NOT NULL DEFAULT 0,
        "failedProducts" integer NOT NULL DEFAULT 0,
        "lastError" text NULL,
        "startedAt" timestamptz NULL,
        "finishedAt" timestamptz NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_initial_sync_store_created"
        ON "initial_sync_jobs" ("storeId", "createdAt");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "initial_sync_jobs"`);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_synced_product_status";
      DROP INDEX IF EXISTS "IDX_synced_product_vendor";
      DROP INDEX IF EXISTS "IDX_synced_product_source";
      ALTER TABLE "synced_products"
        DROP COLUMN IF EXISTS "lastDurationMs",
        DROP COLUMN IF EXISTS "lastError",
        DROP COLUMN IF EXISTS "syncEnabled",
        DROP COLUMN IF EXISTS "status",
        DROP COLUMN IF EXISTS "vendorStoreId",
        DROP COLUMN IF EXISTS "sourceStoreId";
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_batches"
        DROP COLUMN IF EXISTS "operation",
        DROP COLUMN IF EXISTS "destinationStoreId",
        DROP COLUMN IF EXISTS "sourceStoreId";
      DROP TYPE IF EXISTS "sync_batches_operation_enum";
    `);
  }
}
