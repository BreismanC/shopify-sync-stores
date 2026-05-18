import { Injectable } from '@nestjs/common';

@Injectable()
export class TestService {
  getHello(): string {
    return '¡Hola Amo! Conexión Backend -> Frontend exitosa 🐾';
  }
}
