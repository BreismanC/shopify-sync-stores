import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_DATABASE || 'shopify_sync_stores',
  entities: ['dist/domain/entities/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
});
