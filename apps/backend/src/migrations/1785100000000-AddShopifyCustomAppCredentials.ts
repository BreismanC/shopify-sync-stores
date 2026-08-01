import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cada tienda se conecta mediante su propia Custom App de Shopify. El API key
 * identifica la app y el API secret cifrado permite validar el HMAC de sus
 * webhooks. Las columnas son nullable para conservar tiendas creadas antes de
 * esta migración; el DTO de conexión las exige para toda alta o actualización.
 */
export class AddShopifyCustomAppCredentials1785100000000
  implements MigrationInterface
{
  name = 'AddShopifyCustomAppCredentials1785100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stores"
      ADD COLUMN IF NOT EXISTS "apiKey" varchar(255),
      ADD COLUMN IF NOT EXISTS "apiSecret" text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stores"
      DROP COLUMN IF EXISTS "apiSecret",
      DROP COLUMN IF EXISTS "apiKey"
    `);
  }
}
