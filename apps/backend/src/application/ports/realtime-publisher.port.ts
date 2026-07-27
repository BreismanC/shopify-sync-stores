export abstract class IRealtimePublisher {
  abstract publishToTenant(
    tenantId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void>;

  abstract publishToUser(
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
}
