import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreKeyAndStoreConnections1783917545960 implements MigrationInterface {
  name = 'AddStoreKeyAndStoreConnections1783917545960';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stores"
      ADD COLUMN IF NOT EXISTS "storeKey" varchar(64) NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stores_storeKey"
      ON "stores" ("storeKey")
      WHERE "storeKey" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "stores"
      SET "storeKey" = UPPER(MD5(RANDOM()::text || id::text || shopifyShopId::text))
      WHERE "storeKey" IS NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "stores" WHERE "storeKey" IS NULL
        ) THEN
          RAISE EXCEPTION 'Backfill incomplete: rows still have NULL storeKey';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "stores"
      ALTER COLUMN "storeKey" SET NOT NULL
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_stores_storeKey"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_stores_storeKey"
      ON "stores" ("storeKey")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_connections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sourceStoreId" uuid NOT NULL,
        "vendorStoreId" uuid NOT NULL,
        "initiatedByStoreId" uuid NOT NULL,
        "initiatedByUserId" uuid NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "connectedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "disconnectedAt" TIMESTAMP WITH TIME ZONE NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_store_connections" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_store_connections_source_vendor"
      ON "store_connections" ("sourceStoreId", "vendorStoreId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_connections_source"
      ON "store_connections" ("sourceStoreId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_connections_vendor"
      ON "store_connections" ("vendorStoreId")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_store_connections_source'
        ) THEN
          ALTER TABLE "store_connections"
            ADD CONSTRAINT "FK_store_connections_source"
            FOREIGN KEY ("sourceStoreId")
            REFERENCES "stores"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_store_connections_vendor'
        ) THEN
          ALTER TABLE "store_connections"
            ADD CONSTRAINT "FK_store_connections_vendor"
            FOREIGN KEY ("vendorStoreId")
            REFERENCES "stores"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_store_connections_initiated_store'
        ) THEN
          ALTER TABLE "store_connections"
            ADD CONSTRAINT "FK_store_connections_initiated_store"
            FOREIGN KEY ("initiatedByStoreId")
            REFERENCES "stores"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_store_connections_initiated_user'
        ) THEN
          ALTER TABLE "store_connections"
            ADD CONSTRAINT "FK_store_connections_initiated_user"
            FOREIGN KEY ("initiatedByUserId")
            REFERENCES "users"("id")
            ON DELETE SET NULL
            ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "store_connections" DROP CONSTRAINT IF EXISTS "FK_store_connections_initiated_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "store_connections" DROP CONSTRAINT IF EXISTS "FK_store_connections_initiated_store"
    `);

    await queryRunner.query(`
      ALTER TABLE "store_connections" DROP CONSTRAINT IF EXISTS "FK_store_connections_vendor"
    `);

    await queryRunner.query(`
      ALTER TABLE "store_connections" DROP CONSTRAINT IF EXISTS "FK_store_connections_source"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "store_connections"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_store_connections_vendor"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_store_connections_source"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_store_connections_source_vendor"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_stores_storeKey"
    `);

    await queryRunner.query(`
      ALTER TABLE "stores" DROP COLUMN IF EXISTS "storeKey"
    `);
  }
}
