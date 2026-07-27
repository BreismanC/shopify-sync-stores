import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial del proyecto.
 *
 * Esta migración crea todas las tablas base del sistema a partir de las
 * entidades de dominio. Se ejecuta ANTES del resto del historial para
 * garantizar que existan las tablas referenciadas por migraciones
 * posteriores (que asumen un esquema ya creado).
 *
 * Tablas creadas:
 *  - tenants, users, stores
 *  - subscriptions
 *  - team_members, team_invitations
 *  - store_connections (incluye storeKey en stores para evitar una segunda
 *    migración que añade la columna)
 */
export class CreateInitialSchema1000000000000 implements MigrationInterface {
  name = 'CreateInitialSchema1000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. tenants
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenants_status_enum') THEN
          CREATE TYPE "tenants_status_enum" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenants_onboardingStatus_enum') THEN
          CREATE TYPE "tenants_onboardingStatus_enum" AS ENUM (
            'PENDING_TENANT_CONFIG',
            'PENDING_PLAN_SELECTION',
            'PENDING_STORE_CONFIG',
            'PENDING_STORE_ROLE',
            'PENDING_TEAM_CONFIG',
            'COMPLETED'
          );
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "status" "tenants_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "onboardingStatus" "tenants_onboardingStatus_enum" NOT NULL DEFAULT 'PENDING_TENANT_CONFIG',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tenants_name" UNIQUE ("name"),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id")
      )
    `);

    // 2. users
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
          CREATE TYPE "users_role_enum" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NULL,
        "email" varchar NOT NULL,
        "name" varchar NOT NULL,
        "password" varchar NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'MEMBER',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_users_tenant') THEN
          ALTER TABLE "users"
            ADD CONSTRAINT "FK_users_tenant"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    // 3. stores (incluye storeKey desde el inicio — evita una segunda migración)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stores_role_enum') THEN
          CREATE TYPE "stores_role_enum" AS ENUM ('SOURCE', 'VENDOR');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "shopifyShopId" varchar NOT NULL,
        "accessToken" varchar NOT NULL,
        "role" "stores_role_enum" NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "storeKey" varchar(64) NOT NULL,
        "tenantId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_stores_shopifyShopId" UNIQUE ("shopifyShopId"),
        CONSTRAINT "UQ_stores_storeKey" UNIQUE ("storeKey"),
        CONSTRAINT "PK_stores" PRIMARY KEY ("id")
      )
    `);

    // Backfill defensivo: si la tabla ya existía sin storeKey (de un intento
    // previo), la rellenamos y luego aplicamos NOT NULL.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'stores' AND column_name = 'storeKey' AND is_nullable = 'YES'
        ) THEN
          UPDATE "stores"
          SET "storeKey" = UPPER(MD5(RANDOM()::text || id::text || "shopifyShopId"::text))
          WHERE "storeKey" IS NULL;
          ALTER TABLE "stores" ALTER COLUMN "storeKey" SET NOT NULL;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stores_tenant') THEN
          ALTER TABLE "stores"
            ADD CONSTRAINT "FK_stores_tenant"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    // 4. subscriptions
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptions_planType_enum') THEN
          CREATE TYPE "subscriptions_planType_enum" AS ENUM ('TRIAL', 'BASIC', 'PRO', 'ENTERPRISE');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptions_status_enum') THEN
          CREATE TYPE "subscriptions_status_enum" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED', 'PENDING_PAYMENT', 'SUSPENDED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptions_billingPeriod_enum') THEN
          CREATE TYPE "subscriptions_billingPeriod_enum" AS ENUM ('MONTHLY', 'YEARLY');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "planType" "subscriptions_planType_enum" NOT NULL,
        "status" "subscriptions_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "startDate" TIMESTAMP NOT NULL DEFAULT now(),
        "trialEndDate" TIMESTAMP NULL,
        "externalSubscriptionId" varchar NULL,
        "externalPlanId" varchar NULL,
        "billingPeriod" "subscriptions_billingPeriod_enum" NOT NULL DEFAULT 'MONTHLY',
        "autoRecurrent" boolean NOT NULL DEFAULT false,
        "lastBillingDate" TIMESTAMP WITH TIME ZONE NULL,
        "nextBillingDate" TIMESTAMP WITH TIME ZONE NULL,
        "paymentMethodId" varchar NULL,
        "amountPaid" numeric(10,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_subscriptions_tenant') THEN
          ALTER TABLE "subscriptions"
            ADD CONSTRAINT "FK_subscriptions_tenant"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    // 5. team_members (soft-delete)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "role" varchar NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP NULL,
        CONSTRAINT "UQ_team_members_user_tenant" UNIQUE ("userId", "tenantId"),
        CONSTRAINT "PK_team_members" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_team_members_user') THEN
          ALTER TABLE "team_members"
            ADD CONSTRAINT "FK_team_members_user"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_team_members_tenant') THEN
          ALTER TABLE "team_members"
            ADD CONSTRAINT "FK_team_members_tenant"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    // 6. team_invitations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "email" varchar NOT NULL,
        "name" varchar NOT NULL,
        "role" varchar NOT NULL,
        "token" varchar NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "acceptedById" uuid NULL,
        "acceptedAt" TIMESTAMP WITH TIME ZONE NULL,
        "invitedById" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_team_invitations_token" UNIQUE ("token"),
        CONSTRAINT "PK_team_invitations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_team_invitations_tenant_email"
        ON "team_invitations" ("tenantId", "email")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_team_invitations_tenant') THEN
          ALTER TABLE "team_invitations"
            ADD CONSTRAINT "FK_team_invitations_tenant"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_team_invitations_acceptedBy') THEN
          ALTER TABLE "team_invitations"
            ADD CONSTRAINT "FK_team_invitations_acceptedBy"
            FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_team_invitations_invitedBy') THEN
          ALTER TABLE "team_invitations"
            ADD CONSTRAINT "FK_team_invitations_invitedBy"
            FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    // 7. store_connections (incluye columna `status` con su enum)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_connections_status_enum') THEN
          CREATE TYPE "store_connections_status_enum" AS ENUM (
            'PENDING', 'ACTIVE', 'REJECTED', 'REVOKED', 'CANCELED', 'EXPIRED'
          );
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sourceStoreId" uuid NOT NULL,
        "vendorStoreId" uuid NOT NULL,
        "initiatedByStoreId" uuid NOT NULL,
        "initiatedByUserId" uuid NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "status" "store_connections_status_enum" NOT NULL DEFAULT 'PENDING',
        "connectedAt" TIMESTAMP WITH TIME ZONE NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NULL,
        "respondedAt" TIMESTAMP WITH TIME ZONE NULL,
        "disconnectedAt" TIMESTAMP WITH TIME ZONE NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_store_connections_source_vendor" UNIQUE ("sourceStoreId", "vendorStoreId"),
        CONSTRAINT "PK_store_connections" PRIMARY KEY ("id")
      )
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
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_store_connections_source') THEN
          ALTER TABLE "store_connections"
            ADD CONSTRAINT "FK_store_connections_source"
            FOREIGN KEY ("sourceStoreId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_store_connections_vendor') THEN
          ALTER TABLE "store_connections"
            ADD CONSTRAINT "FK_store_connections_vendor"
            FOREIGN KEY ("vendorStoreId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_store_connections_initiated_store') THEN
          ALTER TABLE "store_connections"
            ADD CONSTRAINT "FK_store_connections_initiated_store"
            FOREIGN KEY ("initiatedByStoreId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_store_connections_initiated_user') THEN
          ALTER TABLE "store_connections"
            ADD CONSTRAINT "FK_store_connections_initiated_user"
            FOREIGN KEY ("initiatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "store_connections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_invitations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenants"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "store_connections_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "subscriptions_billingPeriod_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "subscriptions_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "subscriptions_planType_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "stores_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "tenants_onboardingStatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "tenants_status_enum"`);
  }
}
