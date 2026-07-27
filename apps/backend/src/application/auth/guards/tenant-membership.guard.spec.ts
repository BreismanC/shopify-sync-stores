import { ForbiddenException } from '@nestjs/common';
import { TenantMembershipGuard } from './tenant-membership.guard';

describe('TenantMembershipGuard', () => {
  const context = (request: any) =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;
  it('acepta tenant seleccionado con membresía activa', async () => {
    const tenantService = {
      requireMembership: jest.fn().mockResolvedValue({}),
    };
    const guard = new TenantMembershipGuard(tenantService as any);
    const request = {
      user: { id: 'u1', tenantId: 't1' },
      params: { tenantId: 't1' },
    };
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request).toEqual(expect.objectContaining({ tenantId: 't1' }));
  });
  it('rechaza cambiar el tenant solo mediante URL', async () => {
    const guard = new TenantMembershipGuard({
      requireMembership: jest.fn(),
    } as any);
    await expect(
      guard.canActivate(
        context({
          user: { id: 'u1', tenantId: 't1' },
          params: { tenantId: 't2' },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
