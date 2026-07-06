import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env files for Lambda
const envFiles = ['.env', '.env.local', '.env.development'];
for (const file of envFiles) {
  dotenv.config({ path: path.resolve(process.cwd(), file), override: false });
}

export interface LambdaEnvironment {
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_NAME: string;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  NODE_ENV: string;
  AWS_SAM_LOCAL: boolean;
}

export const lambdaEnv: LambdaEnvironment = {
  DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
  DATABASE_PORT: parseInt(process.env.DATABASE_PORT || '5432', 10),
  DATABASE_NAME: process.env.DATABASE_NAME || 'shopify_sync',
  DATABASE_USER: process.env.DATABASE_USER || 'postgres',
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'password',
  NODE_ENV: process.env.NODE_ENV || 'development',
  AWS_SAM_LOCAL: process.env.AWS_SAM_LOCAL === 'true',
};

export default lambdaEnv;