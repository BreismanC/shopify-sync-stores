import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mueve el campo `onboardingStatus` de `users` a `tenants`.
 *
 * El status de onboarding es una propiedad del TENANT (flujo de configuración
 * del espacio de trabajo), no del usuario individual. Los usuarios invitados
 * al equipo deben heredar el status de su tenant y NO deben pasar por el
 * flujo de onboarding.
 *
 * Reglas de migración de datos:
 * - El OWNER del tenant (user con role=OWNER) lleva su onboardingStatus al tenant.
 * - Cualquier otro user (MEMBER/ADMIN) tenía status PENDING_TENANT_CONFIG por
 *   default; ya no es relevante porque se deriva del tenant.
 * - Si un tenant tiene múltiples usuarios con onboardingStatus distintos,
 *   gana el del OWNER. Si no hay OWNER, el primero con status != COMPLETED.
 *
 * NOTA: Este proyecto asume entorno de desarrollo (la BD se puede resetear).
 * Si hubiera datos en producción, se necesitaría un script de migración más
 * cuidadoso.
 */
export class MoveOnboardingStatusToTenant1783398456209 implements MigrationInterface {
  name = 'MoveOnboardingStatusToTenant1783398456209';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear el nuevo enum type para tenants.
    //    Se crea con un nombre estable que no depende de cómo TypeORM lo
    //    haya generado al crear la columna original.
    await queryRunner.query(`
      DO $$
      BEGIN
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

    // 2. Agregar la columna en tenants usando el nuevo enum type
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN "onboardingStatus" "tenants_onboardingStatus_enum"
      NOT NULL DEFAULT 'PENDING_TENANT_CONFIG'
    `);

    // 3. Poblar tenants.onboardingStatus desde el OWNER del tenant.
    //    Si no hay OWNER, usar el status más común no-COMPLETED del tenant.
    //    Si ningún usuario tenía status, queda PENDING_TENANT_CONFIG.
    await queryRunner.query(`
      UPDATE "tenants" t
      SET "onboardingStatus" = COALESCE(
        (
          SELECT u."onboardingStatus"::text::"tenants_onboardingStatus_enum"
          FROM "users" u
          WHERE u."tenantId" = t.id AND u."role" = 'OWNER'
          ORDER BY u."createdAt" ASC
          LIMIT 1
        ),
        (
          SELECT u."onboardingStatus"::text::"tenants_onboardingStatus_enum"
          FROM "users" u
          WHERE u."tenantId" = t.id AND u."onboardingStatus" <> 'COMPLETED'
          ORDER BY u."createdAt" ASC
          LIMIT 1
        ),
        (
          SELECT u."onboardingStatus"::text::"tenants_onboardingStatus_enum"
          FROM "users" u
          WHERE u."tenantId" = t.id
          ORDER BY u."createdAt" ASC
          LIMIT 1
        ),
        'PENDING_TENANT_CONFIG'::"tenants_onboardingStatus_enum"
      )
    `);

    // 4. Eliminar la columna de users
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "onboardingStatus"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restaurar columna en users usando el enum original
    // (TypeORM usa el patrón "<tabla>_<columna>_enum" por defecto).
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "onboardingStatus" "users_onboardingStatus_enum"
      NOT NULL DEFAULT 'PENDING_TENANT_CONFIG'
    `);

    // Sincronizar de vuelta: cada user toma el status de su tenant
    await queryRunner.query(`
      UPDATE "users" u
      SET "onboardingStatus" = COALESCE(
        (SELECT t."onboardingStatus"::text::"users_onboardingStatus_enum"
         FROM "tenants" t WHERE t.id = u."tenantId"),
        'PENDING_TENANT_CONFIG'::"users_onboardingStatus_enum"
      )
    `);

    // Eliminar columna y enum type de tenants
    await queryRunner.query(`
      ALTER TABLE "tenants" DROP COLUMN "onboardingStatus"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "tenants_onboardingStatus_enum"
    `);
  }
}
