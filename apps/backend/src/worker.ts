import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const envPath = resolve(__dirname, '..', '.env');
loadEnv({ path: envPath });

async function bootstrap() {
  process.env.RUN_WORKERS = 'true';
  await NestFactory.createApplicationContext(AppModule);
}

void bootstrap();
