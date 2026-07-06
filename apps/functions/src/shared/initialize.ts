import { initializeDataSource, closeDataSource } from '@shopify-sync/database';

let initialized = false;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;

  const isLocal = process.env.AWS_SAM_LOCAL === 'true' || process.env.NODE_ENV === 'development';
  console.log(`[Initialize] Database init (local=${isLocal}, env=${process.env.NODE_ENV})`);

  await initializeDataSource();
  initialized = true;
  console.log('[Initialize] Database initialized successfully');
}

export async function shutdownDatabase(): Promise<void> {
  if (!initialized) return;
  await closeDataSource();
  initialized = false;
  console.log('[Initialize] Database connection closed');
}

export function isLocalEnvironment(): boolean {
  return process.env.AWS_SAM_LOCAL === 'true' || process.env.NODE_ENV === 'development';
}