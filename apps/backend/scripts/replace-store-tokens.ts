/**
 * Reemplaza los access tokens de tiendas específicas cifrándolos con la
 * utilidad actual (AES-256-CBC + SHA-256 sobre ENCRYPTION_KEY).
 *
 * Por qué existe: la utilidad antigua derivaba la clave de manera distinta
 * y los registros existentes quedaron irrecuperables. Para evitar pedir a
 * cada tienda volver a hacer el flujo de OAuth, este script toma los tokens
 * en claro, los cifra con la clave actual y los persiste.
 *
 * Uso (desde apps/backend):
 *   pnpm exec ts-node -r tsconfig-paths/register \
 *     scripts/replace-store-tokens.ts \
 *     --store=<uuid>:<tokenEnClaro> \
 *     [--store=<uuid>:<tokenEnClaro>] ...
 *
 *   # Aplicar los cambios (sin --apply corre en dry-run):
 *   ... --apply
 *
 * El script verifica que el `shopifyShopId` del id solicitado coincida con
 * el dominio esperado (`--expect <dominio>` opcional) para evitar pisar la
 * tienda equivocada.
 */

import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import * as crypto from 'node:crypto';
import * as path from 'node:path';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const APPLY = process.argv.includes('--apply');
const ARGS = process.argv.filter((a) => a.startsWith('--store='));
const EXPECT_DOMAIN = (() => {
  const idx = process.argv.findIndex((a) => a === '--expect');
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

interface Update {
  id: string;
  plain: string;
  expectedDomain?: string;
}

const updates: Update[] = ARGS.map((arg) => {
  const value = arg.slice('--store='.length);
  const [id, ...rest] = value.split(':');
  return { id, plain: rest.join(':') };
});

if (updates.length === 0) {
  console.error(
    'ERROR: pasá al menos un par --store=<uuid>:<tokenEnClaro>.',
  );
  process.exit(1);
}

function encryptWithCurrentUtility(plain: string): string {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey || envKey.length === 0) {
    throw new Error('ENCRYPTION_KEY no está definida en el entorno.');
  }
  const key = crypto.createHash('sha256').update(envKey).digest();
  if (key.length !== 32) {
    throw new Error(`La clave derivada mide ${key.length} bytes (debería medir 32).`);
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let out = cipher.update(plain, 'utf8', 'hex');
  out += cipher.final('hex');
  return `${iv.toString('hex')}:${out}`;
}

function decryptWithCurrentUtility(token: string): string {
  if (!/^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(token)) {
    throw new Error('Formato de token inesperado.');
  }
  const envKey = process.env.ENCRYPTION_KEY ?? '';
  const key = crypto.createHash('sha256').update(envKey).digest();
  const [ivHex, enc] = token.split(':');
  const d = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
  let out = d.update(enc, 'hex', 'utf8');
  out += d.final('utf8');
  return out;
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  const prepared: Array<{ id: string; plain: string; encrypted: string; domain: string }> = [];

  for (const u of updates) {
    // 1) Roundtrip local: ciframos y verificamos que descifra igual.
    const encrypted = encryptWithCurrentUtility(u.plain);
    const roundtrip = decryptWithCurrentUtility(encrypted);
    if (roundtrip !== u.plain) {
      throw new Error(`Roundtrip falló para ${u.id}.`);
    }

    // 2) Verificamos que la tienda existe y, si se pidió, que su dominio
    // coincide con el esperado.
    const { rows } = await pool.query<{ shopifyShopId: string }>(
      'SELECT "shopifyShopId" FROM stores WHERE id = $1',
      [u.id],
    );
    if (rows.length === 0) {
      throw new Error(`No existe la tienda con id ${u.id}.`);
    }
    const domain = rows[0].shopifyShopId;
    if (EXPECT_DOMAIN && EXPECT_DOMAIN !== domain) {
      throw new Error(
        `Se esperaba dominio ${EXPECT_DOMAIN} pero la tienda ${u.id} es ${domain}.`,
      );
    }
    prepared.push({ id: u.id, plain: u.plain, encrypted, domain });
  }

  console.log('A aplicar:');
  for (const p of prepared) {
    console.log(` - ${p.id} (${p.domain})`);
  }

  if (!APPLY) {
    console.log('\nDry-run. Para aplicar: --apply');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of prepared) {
      await client.query(
        'UPDATE stores SET "accessToken" = $1, "updatedAt" = NOW() WHERE id = $2',
        [p.encrypted, p.id],
      );
    }
    await client.query('COMMIT');
    console.log(`Actualizadas ${prepared.length} filas.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});