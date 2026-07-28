import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IRealtimePublisher } from '../../application/ports/realtime-publisher.port';
import { SyncGateway } from './sync.gateway';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    SyncGateway,
    { provide: IRealtimePublisher, useExisting: SyncGateway },
  ],
  exports: [IRealtimePublisher, SyncGateway],
})
export class RealtimeModule {}
