import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Payload firmado por `MercadoPagoTokenService`.
 *
 * Se usa como credencial temporal para consultar el estado de un
 * preapproval en un endpoint PÚBLICO (sin JWT de sesión). La gracia:
 * MercadoPago redirige al usuario a un `back_url` cross-site que NO
 * puede llevar cookies de sesión de manera confiable; en su lugar
 * llevamos un token firmado con TTL corto en la query string.
 */
export interface MercadoPagoStatusTokenPayload {
  preapprovalId: string;
  tenantId: string;
  userId: string;
}

interface JwtSignedPayload extends MercadoPagoStatusTokenPayload {
  iat: number;
  exp: number;
}

const DEFAULT_TTL_SECONDS = 30 * 60; // 30 min

/**
 * MercadoPagoTokenService
 *
 * Emite y verifica tokens JWT cortos que se adjuntan al `back_url`
 * que MP usa para redirigir al usuario de vuelta al frontend después
 * del pago. Esto permite que la página `/payments/status` (pública)
 * consulte el estado del preapproval sin depender de la cookie de
 * sesión de NextAuth, que MP puede no reenviar en una redirección
 * cross-site.
 *
 * Seguridad:
 * - Usa un secret DISTINTO del `AUTH_SECRET` para que un token de
 *   pago no sea aceptable como token de autenticación de usuario.
 * - TTL corto (30 min por defecto) para limitar la ventana de uso.
 * - El `verify` valida firma + expiración, y valida que el
 *   `preapprovalId` del payload coincida con el de la query.
 */
@Injectable()
export class MercadoPagoTokenService {
  private readonly secret: string;
  private readonly ttlSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.secret =
      configService.get<string>('MERCADOPAGO_STATUS_TOKEN_SECRET') ??
      configService.get<string>('AUTH_SECRET') ??
      'super-secret-key';

    this.ttlSeconds =
      Number(
        configService.get<string>('MERCADOPAGO_STATUS_TOKEN_TTL_SECONDS'),
      ) || DEFAULT_TTL_SECONDS;
  }

  /**
   * Emite un token firmado para un preapproval.
   */
  sign(payload: MercadoPagoStatusTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.secret,
      expiresIn: this.ttlSeconds,
    });
  }

  /**
   * Verifica un token. Si el `preapprovalId` del payload no coincide
   * con el `expectedPreapprovalId`, falla con `UnauthorizedException`.
   */
  verify(token: string, expectedPreapprovalId: string): MercadoPagoStatusTokenPayload {
    let decoded: JwtSignedPayload;
    try {
      decoded = this.jwtService.verify<JwtSignedPayload>(token, {
        secret: this.secret,
      });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    if (!decoded.preapprovalId || decoded.preapprovalId !== expectedPreapprovalId) {
      throw new UnauthorizedException('El token no corresponde al preapproval');
    }

    return {
      preapprovalId: decoded.preapprovalId,
      tenantId: decoded.tenantId,
      userId: decoded.userId,
    };
  }
}