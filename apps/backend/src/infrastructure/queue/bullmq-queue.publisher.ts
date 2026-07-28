import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  IQueuePublisher,
  QueueJobOptions,
} from '../../application/ports/queue-publisher.port';
import { BULL_QUEUES } from './queue.constants';

@Injectable()
export class BullMqQueuePublisher
  implements IQueuePublisher, OnApplicationShutdown
{
  constructor(
    @Inject(BULL_QUEUES) private readonly queues: Map<string, Queue>,
  ) {}

  async publish<T extends Record<string, unknown>>(
    queueName: string,
    name: string,
    payload: T,
    options: QueueJobOptions = {},
  ): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue not configured: ${queueName}`);
    const job = await queue.add(name, payload, {
      jobId: options.jobId,
      attempts: options.attempts ?? 5,
      backoff: { type: 'exponential', delay: options.backoffMs ?? 1000 },
      delay: options.delay,
      deduplication: options.deduplicationId
        ? {
            id: options.deduplicationId,
            ttl: options.deduplicationTtl ?? 8_000,
          }
        : undefined,
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: false,
    });
    return String(job.id);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}
