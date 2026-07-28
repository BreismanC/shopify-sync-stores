import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantMemberships1784500000000 implements MigrationInterface {
  name = 'CreateTenantMemberships1784500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tenant_memberships_status_enum" AS ENUM('ACTIVE', 'INVITED', 'REVOKED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tenantId" uuid NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'MEMBER', "status" "public"."tenant_memberships_status_enum" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_tenant_memberships_user_tenant" UNIQUE ("userId", "tenantId"), CONSTRAINT "PK_tenant_memberships" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tenant_memberships_user_status" ON "tenant_memberships" ("userId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tenant_memberships_tenant_status" ON "tenant_memberships" ("tenantId", "status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_memberships" ADD CONSTRAINT "FK_tenant_memberships_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_memberships" ADD CONSTRAINT "FK_tenant_memberships_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `INSERT INTO "tenant_memberships" ("userId", "tenantId", "role") SELECT "id", "tenantId", "role" FROM "users" WHERE "tenantId" IS NOT NULL ON CONFLICT DO NOTHING`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_memberships" DROP CONSTRAINT "FK_tenant_memberships_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_memberships" DROP CONSTRAINT "FK_tenant_memberships_user"`,
    );
    await queryRunner.query(`DROP TABLE "tenant_memberships"`);
    await queryRunner.query(
      `DROP TYPE "public"."tenant_memberships_status_enum"`,
    );
  }
}
