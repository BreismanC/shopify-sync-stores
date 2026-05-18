import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'password',
  database: 'test',
  entities: ['src/domain/entities/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
