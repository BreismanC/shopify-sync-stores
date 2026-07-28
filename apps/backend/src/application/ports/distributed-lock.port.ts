export class DistributedLockUnavailableError extends Error {
  constructor(key: string) {
    super(`Distributed lock unavailable: ${key}`);
    this.name = 'DistributedLockUnavailableError';
  }
}

export abstract class IDistributedLock {
  abstract acquire(key: string, ttlMs: number): Promise<string | null>;
  abstract release(key: string, token: string): Promise<void>;
}
