import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shopify identifica las variantes con GIDs (`gid://shopify/ProductVariant/...`),
 * por lo que la variante destino no puede almacenarse como UUID.
 *
 * Las conexiones creadas directamente mediante storeKey son aceptadas en el
 * mismo request; por tanto, deben quedar ACTIVE y no PENDING.
 */
export class FixVendorVariantIdsAndConnectionStatus1785000000000
  implements MigrationInterface
{
  name = 'FixVendorVariantIdsAndConnectionStatus1785000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "variant_syncs"
      ALTER COLUMN "vendorVariantId" TYPE varchar
      USING "vendorVariantId"::text
    `);

    await queryRunner.query(`
      UPDATE "store_connections"
      SET "status" = 'ACTIVE'::"store_connections_status_enum",
          "updatedAt" = now()
      WHERE "isActive" = true
        AND "status" = 'PENDING'::"store_connections_status_enum"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "variant_syncs"
      ALTER COLUMN "vendorVariantId" TYPE uuid
      USING "vendorVariantId"::uuid
    `);
  }
}
