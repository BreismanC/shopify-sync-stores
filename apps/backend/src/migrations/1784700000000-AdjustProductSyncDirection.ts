import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdjustProductSyncDirection1784700000000 implements MigrationInterface {
  name = 'AdjustProductSyncDirection1784700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "sync_batches_operation_enum" AS ENUM ('CATALOG_REFRESH','PRODUCT_REPLICATION')`,
    );
    await queryRunner.query(
      `ALTER TABLE "sync_batches" ALTER COLUMN "connectionId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "sync_batches" ADD COLUMN "sourceStoreId" uuid NULL, ADD COLUMN "destinationStoreId" uuid NULL, ADD COLUMN "operation" "sync_batches_operation_enum" NULL`,
    );
    await queryRunner.query(
      `UPDATE "sync_batches" batch SET "sourceStoreId" = connection."sourceStoreId", "destinationStoreId" = connection."vendorStoreId", "operation" = 'PRODUCT_REPLICATION'::"sync_batches_operation_enum" FROM "store_connections" connection WHERE batch."connectionId" = connection."id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sync_batches" ALTER COLUMN "sourceStoreId" SET NOT NULL, ALTER COLUMN "destinationStoreId" SET NOT NULL, ALTER COLUMN "operation" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sync_batch_tenant_source_status" ON "sync_batches" ("tenantId","sourceStoreId","status")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sync_batch_tenant_source_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sync_batches" DROP COLUMN "operation", DROP COLUMN "destinationStoreId", DROP COLUMN "sourceStoreId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sync_batches" ALTER COLUMN "connectionId" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "sync_batches_operation_enum"`,
    );
  }
}
