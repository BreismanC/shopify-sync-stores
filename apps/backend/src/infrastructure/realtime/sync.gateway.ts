import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
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

type RealtimeMessage = {
  scope: 'tenant' | 'user';
  id: string;
  event: string;
  payload: Record<string, unknown>;
};

@Injectable()
@WebSocketGateway({
  namespace: '/sync',
  path: '/sync/socket.io',
  cors: { origin: true, credentials: true },
})
export class SyncGateway
  implements
    IRealtimePublisher,
    OnGatewayConnection,
    OnModuleInit,
    OnApplicationShutdown
{
  private readonly logger = new Logger(SyncGateway.name);
  @WebSocketServer() private server: Server;
  private readonly realtimeChannel = 'sss:realtime';
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    const options = {
      host: config.get<string>('REDIS_HOST', '127.0.0.1'),
      port: config.get<number>('REDIS_PORT', 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      db: config.get<number>('REDIS_DB', 0),
      maxRetriesPerRequest: null,
    };
    this.publisher = new Redis(options);
    this.subscriber = new Redis(options);
  }

  async onModuleInit(): Promise<void> {
    this.subscriber.on('message', (_channel, rawMessage) => {
      try {
        const message = JSON.parse(rawMessage) as RealtimeMessage;
        const room = `${message.scope}:${message.id}`;
        this.server?.to(room).emit(message.event, message.payload);
      } catch (error) {
        this.logger.warn(`Evento realtime inválido: ${String(error)}`);
      }
    });
    await this.subscriber.subscribe(this.realtimeChannel);
  }

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
    return this.publish({
      scope: 'tenant',
      id: tenantId,
      event,
      payload,
    });
  }

  publishToUser(
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    return this.publish({
      scope: 'user',
      id: userId,
      event,
      payload,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);
  }

  private async publish(message: RealtimeMessage): Promise<void> {
    try {
      await this.publisher.publish(
        this.realtimeChannel,
        JSON.stringify(message),
      );
    } catch (error) {
      this.logger.warn(`No fue posible publicar evento realtime: ${String(error)}`);
    }
  }
}
