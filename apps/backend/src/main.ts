import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configurar prefijo global para la API
  app.setGlobalPrefix('api');

  // Habilitar CORS para permitir peticiones desde el frontend
  app.enableCors();

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend running on: http://localhost:${port}/api`);
}
void bootstrap();
