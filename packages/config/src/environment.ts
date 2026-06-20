import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env files in order: .env.base, .env.{NODE_ENV}, .env.local
const envFiles = [
  '.env.base',
  `.env.${process.env.NODE_ENV || 'development'}`,
  '.env.local',
];

for (const file of envFiles) {
  dotenv.config({ path: path.resolve(process.cwd(), file) });
}

export interface EnvironmentConfig {
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_NAME: string;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  AWS_REGION: string;
  AWS_SAM_LOCAL: boolean;
  MERCADOPAGO_ACCESS_TOKEN: string;
  MERCADOPAGO_PUBLIC_KEY: string;
  MERCADOPAGO_SANDBOX: boolean;
  MERCADOPAGO_WEBHOOK_SECRET: string;
  NODE_ENV: string;
  PORT: number;
  SITE_URL: string;
}

function getEnv(key: string, fallback: string | number | boolean = ''): string | number | boolean {
  const value = process.env[key];
  if (value === undefined) return fallback;
  if (typeof fallback === 'number') return parseInt(value, 10);
  if (typeof fallback === 'boolean') return value === 'true';
  return value;
}

export const env: EnvironmentConfig = {
  DATABASE_HOST: getEnv('DATABASE_HOST', getEnv('DB_HOST', 'localhost')) as string,
  DATABASE_PORT: getEnv('DATABASE_PORT', getEnv('DB_PORT', 5432)) as number,
  DATABASE_NAME: getEnv('DATABASE_NAME', getEnv('DB_DATABASE', 'shopify_sync')) as string,
  DATABASE_USER: getEnv('DATABASE_USER', getEnv('DB_USERNAME', 'postgres')) as string,
  DATABASE_PASSWORD: getEnv('DATABASE_PASSWORD', getEnv('DB_PASSWORD', 'password')) as string,
  AWS_REGION: getEnv('AWS_REGION', 'us-east-1') as string,
  AWS_SAM_LOCAL: getEnv('AWS_SAM_LOCAL', 'false') === 'true' || process.env.AWS_SAM_LOCAL === 'true',
  MERCADOPAGO_ACCESS_TOKEN: getEnv('MERCADOPAGO_ACCESS_TOKEN', '') as string,
  MERCADOPAGO_PUBLIC_KEY: getEnv('MERCADOPAGO_PUBLIC_KEY', '') as string,
  MERCADOPAGO_SANDBOX: getEnv('MERCADOPAGO_SANDBOX', 'true') === 'true',
  MERCADOPAGO_WEBHOOK_SECRET: getEnv('MERCADOPAGO_WEBHOOK_SECRET', '') as string,
  NODE_ENV: getEnv('NODE_ENV', 'development') as string,
  PORT: getEnv('PORT', 3001) as number,
  SITE_URL: getEnv('SITE_URL', 'http://localhost:3000') as string,
};

export default env;