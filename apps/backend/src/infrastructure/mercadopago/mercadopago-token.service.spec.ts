import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoTokenService } from './mercadopago-token.service';

const FIXED_PAYLOAD = {
  preapprovalId: 'pre-123',
  tenantId: 'tenant-abc',
  userId: 'user-xyz',
};

const buildSvc = (
  secret: string,
  ttlSeconds = 30 * 60,
): MercadoPagoTokenService => {
  const jwt = new JwtService({
    secret,
    signOptions: { expiresIn: `${ttlSeconds}s` },
  });
  const config = ({
    get: (key: string) => {
      if (key === 'MERCADOPAGO_STATUS_TOKEN_SECRET') return secret;
      if (key === 'MERCADOPAGO_STATUS_TOKEN_TTL_SECONDS') return String(ttlSeconds);
      return undefined;
    },
  } as unknown) as ConfigService;
  return new MercadoPagoTokenService(jwt, config);
};

describe('MercadoPagoTokenService', () => {
  it('signs and verifies a token for the same preapprovalId', () => {
    const svc = buildSvc('test-secret-1');
    const token = svc.sign(FIXED_PAYLOAD);
    const decoded = svc.verify(token, FIXED_PAYLOAD.preapprovalId);
    expect(decoded).toEqual(FIXED_PAYLOAD);
  });

  it('rejects a tampered token (invalid signature)', () => {
    const svc = buildSvc('test-secret-1');
    const token = svc.sign(FIXED_PAYLOAD);
    const tampered = token.slice(0, -3) + 'aaa';
    expect(() => svc.verify(tampered, FIXED_PAYLOAD.preapprovalId)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the token was signed with a different secret', () => {
    const signer = buildSvc('test-secret-1');
    const verifier = buildSvc('test-secret-2');
    const token = signer.sign(FIXED_PAYLOAD);
    expect(() => verifier.verify(token, FIXED_PAYLOAD.preapprovalId)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the payload preapprovalId does not match the query one', () => {
    const svc = buildSvc('test-secret-1');
    const token = svc.sign(FIXED_PAYLOAD);
    expect(() => svc.verify(token, 'OTHER-PRE-ID')).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects malformed tokens', () => {
    const svc = buildSvc('test-secret-1');
    expect(() => svc.verify('not-a-jwt', FIXED_PAYLOAD.preapprovalId)).toThrow(
      UnauthorizedException,
    );
    expect(() => svc.verify('', FIXED_PAYLOAD.preapprovalId)).toThrow(
      UnauthorizedException,
    );
  });
});