export interface QueueJobOptions {
  jobId?: string;
  attempts?: number;
  backoffMs?: number;
  delay?: number;
}

export abstract class IQueuePublisher {
  abstract publish<T extends Record<string, unknown>>(
    queue: string,
    name: string,
    payload: T,
    options?: QueueJobOptions,
  ): Promise<string>;
}
