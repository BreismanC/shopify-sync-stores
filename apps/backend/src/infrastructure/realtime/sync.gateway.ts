import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { IRealtimePublisher } from '../../application/ports/realtime-publisher.port';
import { asScalarString } from '../../application/common/scalar';

interface SocketClaims {
  sub: string;
  tenantId?: string | null;
  sessionVersion?: number;
}

@Injectable()
@WebSocketGateway({
  namespace: '/sync',
  cors: { origin: true, credentials: true },
})
export class SyncGateway implements IRealtimePublisher {
  private readonly logger = new Logger(SyncGateway.name);
  @WebSocketServer() private server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const auth = client.handshake.auth as { token?: unknown };
      const raw = auth.token ?? client.handshake.headers.authorization;
      const token = asScalarString(raw).replace(/^Bearer\s+/i, '');
      const claims = await this.jwtService.verifyAsync<SocketClaims>(token, {
        secret: this.config.get<string>('AUTH_SECRET') || 'super-secret-key',
      });
      const socketData = client.data as Record<string, unknown>;
      socketData.userId = claims.sub;
      socketData.tenantId = claims.tenantId;
      await client.join(`user:${claims.sub}`);
      if (claims.tenantId) await client.join(`tenant:${claims.tenantId}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('ping')
  ping(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    const socketData = client.data as Record<string, unknown>;
    return { event: 'pong', data: payload, tenantId: socketData.tenantId };
  }

  publishToTenant(
    tenantId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.server?.to(`tenant:${tenantId}`).emit(event, payload);
    return Promise.resolve();
  }

  publishToUser(
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.server?.to(`user:${userId}`).emit(event, payload);
    return Promise.resolve();
  }
}
