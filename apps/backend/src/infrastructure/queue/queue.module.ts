import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { IQueuePublisher } from '../../application/ports/queue-publisher.port';
import { BullMqQueuePublisher } from './bullmq-queue.publisher';
import { ALL_QUEUE_NAMES, BULL_QUEUES } from './queue.constants';
import { IDistributedLock } from '../../application/ports/distributed-lock.port';
import { RedisDistributedLock } from './redis-distributed-lock';

@Global()
@Module({
  providers: [
    {
      provide: BULL_QUEUES,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connection = {
          host: config.get<string>('REDIS_HOST', '127.0.0.1'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_DB', 0),
        };
        return new Map(
          ALL_QUEUE_NAMES.map((name) => [
            name,
            new Queue(name, {
              connection,
              prefix: config.get<string>('QUEUE_PREFIX', 'sss'),
            }),
          ]),
        );
      },
    },
    BullMqQueuePublisher,
    { provide: IQueuePublisher, useExisting: BullMqQueuePublisher },
    RedisDistributedLock,
    { provide: IDistributedLock, useExisting: RedisDistributedLock },
  ],
  exports: [IQueuePublisher, IDistributedLock, BULL_QUEUES],
})
export class QueueModule {}
