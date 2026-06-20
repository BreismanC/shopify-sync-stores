import { DataSource, DataSourceOptions, EntityManager } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { Tenant } from './entities/tenant.entity';
import { User } from './entities/user.entity';
import { Store } from './entities/store.entity';

export function getDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432', 10),
    username: process.env.DATABASE_USER || process.env.DB_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || process.env.DB_DATABASE || 'shopify_sync',
    entities: [Subscription, Tenant, User, Store],
    migrations: [],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development' || process.env.AWS_SAM_LOCAL === 'true',
  };
}

let dataSourceInstance: DataSource | null = null;

export async function initializeDataSource(): Promise<DataSource> {
  if (dataSourceInstance?.isInitialized) {
    return dataSourceInstance;
  }

  const options = getDataSourceOptions();
  dataSourceInstance = new DataSource(options);
  await dataSourceInstance.initialize();
  return dataSourceInstance;
}

export async function getDataSource(): Promise<DataSource> {
  if (!dataSourceInstance?.isInitialized) {
    return initializeDataSource();
  }
  return dataSourceInstance;
}

export async function closeDataSource(): Promise<void> {
  if (dataSourceInstance?.isInitialized) {
    await dataSourceInstance.destroy();
    dataSourceInstance = null;
  }
}

export function getEntityManager(): EntityManager {
  if (!dataSourceInstance?.isInitialized) {
    throw new Error('DataSource not initialized. Call initializeDataSource() first.');
  }
  return dataSourceInstance.manager;
}