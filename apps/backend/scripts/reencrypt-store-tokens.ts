/**
 * Re-cifra los access tokens de la tabla `stores` cuando se rota
 * `ENCRYPTION_KEY`.
 *
 * Por qué existe: la utilidad `EncryptionUtil` derivaba la clave haciendo
 * `Buffer.from(process.env.ENCRYPTION_KEY, 'utf-8')` y ahora la deriva con
 * `sha256(env)`. Cualquier token persistido con la clave anterior se vuelve
 * irrecuperable, así que antes de hacer el switch hay que re-cifrar los
 * registros usando ambas claves.
 *
 * Uso:
 *   # Sólo diagnóstico (no muta nada):
 *   OLD_ENCRYPTION_KEY=<clave_vieja> NEW_ENCRYPTION_KEY=<clave_nueva> \
 *     npx ts-node -r tsconfig-paths/register \
 *       apps/backend/scripts/reencrypt-store-tokens.ts
 *
 *   # Aplicar los cambios:
 *   ... --apply
 *
 * Si la clave vieja no estaba definida cuando se cifró, exportá
 * `OLD_ENCRYPTION_KEY=` (vacía) y el script intentará también el fallback
 * determinístico de la utilidad anterior ('default-secret-key-must-be-32-chars!!').
 */

import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import * as crypto from 'node:crypto';
import * as path from 'node:path';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const APPLY = process.argv.includes('--apply');

const OLD_RAW = process.env.OLD_ENCRYPTION_KEY ?? '';
const NEW_RAW = process.env.NEW_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY ?? '';

if (!NEW_RAW) {
  console.error('ERROR: NEW_ENCRYPTION_KEY (o ENCRYPTION_KEY) es obligatoria.');
  process.exit(1);
}

// Reproduce la utilidad anterior (clave cruda) y la nueva (SHA-256).
const OLD_FALLBACK = 'shopify-sync-stores-dev-encryption-key';

function oldKeys(rawEnv: string): Buffer[] {
  const raw = rawEnv && rawEnv.length > 0 ? rawEnv : OLD_FALLBACK;
  return [
    Buffer.from(raw, 'utf-8'),
    crypto.createHash('sha256').update(raw).digest(),
  ];
}

function newKey(rawEnv: string): Buffer {
  return crypto.createHash('sha256').update(rawEnv).digest();
}

function decryptWith(key: Buffer, token: string): string | null {
  if (!/^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(token)) return null;
  try {
    const [ivHex, enc] = token.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const d = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let out = d.update(enc, 'hex', 'utf8');
    out += d.final('utf8');
    return out;
  } catch {
    return null;
  }
}

function encryptWith(key: Buffer, plain: string): string {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-cbc', key, iv);
  let out = c.update(plain, 'utf8', 'hex');
  out += c.final('hex');
  return `${iv.toString('hex')}:${out}`;
}

interface Row {
  id: string;
  shopifyShopId: string;
  accessToken: string;
  apiSecret: string | null;
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  const { rows } = await pool.query<Row>(
    'SELECT id, "shopifyShopId", "accessToken", "apiSecret" FROM stores ORDER BY "createdAt"',
  );

  const old = oldKeys(OLD_RAW);
  const neu = newKey(NEW_RAW);

  const stats = {
    total: rows.length,
    alreadyOk: 0,
    reencrypted: 0,
    unrecoverable: 0,
    plain: 0,
  };
  const unrecoverable: Array<{ id: string; shopifyShopId: string }> = [];
  const updates: Array<{ id: string; newToken: string }> = [];

  for (const row of rows) {
    // Si ya descifra con la clave nueva, está OK.
    if (decryptWith(neu, row.accessToken) !== null) {
      stats.alreadyOk++;
      continue;
    }
    // Si estaba en claro (token legacy), lo dejamos y avisamos.
    if (!/^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(row.accessToken)) {
      stats.plain++;
      continue;
    }
    // Probamos con la clave vieja.
    const plain = old.map((key) => decryptWith(key, row.accessToken)).find((value) => value !== null) ?? null;
    if (plain === null) {
      stats.unrecoverable++;
      unrecoverable.push({ id: row.id, shopifyShopId: row.shopifyShopId });
      continue;
    }
    updates.push({ id: row.id, newToken: encryptWith(neu, plain) });
    stats.reencrypted++;
  }

  console.log('Resumen:', stats);
  if (unrecoverable.length) {
    console.log('Irrecuperables:');
    for (const u of unrecoverable) console.log(' -', u.id, u.shopifyShopId);
  }

  if (!APPLY) {
    console.log('\nDry-run. Para aplicar: --apply');
    await pool.end();
    return;
  }

  if (updates.length === 0) {
    console.log('Nada que actualizar.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      await client.query('UPDATE stores SET "accessToken" = $1 WHERE id = $2', [
        u.newToken,
        u.id,
      ]);
    }
    await client.query('COMMIT');
    console.log(`Actualizadas ${updates.length} filas.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
