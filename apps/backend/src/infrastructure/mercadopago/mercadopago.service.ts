import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoConfig,
  type Payment,
  type Preference,
  type PreApproval,
  type PreApprovalPlan,
} from 'mercadopago';
import { randomUUID } from 'crypto';
import {
  SubscriptionPlan,
  PLAN_PRICING,
} from '../../domain/enums/subscription-plan.enum';
import { BillingPeriod } from '../../domain/enums/billing-period.enum';

/**
 * Injection tokens for the MercadoPago SDK clients.
 *
 * Cada cliente del SDK se inyecta por constructor para mantener el servicio
 * 100% testeable sin un sandbox global: en tests pasamos implementaciones
 * con `useValue` que mockean `preference.create`, etc.
 *
 * En producción, el módulo provee las instancias reales con un `useFactory`
 * que las construye a partir del access token.
 */
export const MERCADOPAGO_CONFIG = Symbol('MERCADOPAGO_CONFIG');
export const MERCADOPAGO_PREFERENCE_CLIENT = Symbol(
  'MERCADOPAGO_PREFERENCE_CLIENT',
);
export const MERCADOPAGO_PRE_APPROVAL_CLIENT = Symbol(
  'MERCADOPAGO_PRE_APPROVAL_CLIENT',
);
export const MERCADOPAGO_PRE_APPROVAL_PLAN_CLIENT = Symbol(
  'MERCADOPAGO_PRE_APPROVAL_PLAN_CLIENT',
);
export const MERCADOPAGO_PAYMENT_CLIENT = Symbol('MERCADOPAGO_PAYMENT_CLIENT');

/**
 * Mínimo subset del response de `/preapproval` que necesitamos.
 * Definido localmente porque el SDK v3 exporta los tipos pero queremos
 * documentar explícitamente los campos que leemos de la respuesta.
 */
interface PreapprovalResponse {
  id?: string;
  status?: string;
  init_point?: string;
  sandbox_init_point?: string;
  external_reference?: string | null;
  date_created?: string;
  next_payment_date?: string;
}

/**
 * MercadoPago Service — SDK oficial `mercadopago` v3+
 *
 * Esta clase ya NO usa `fetch` directo. Toda la comunicación contra la API
 * de MercadoPago se hace a través del SDK oficial `mercadopago`
 * (https://www.npmjs.com/package/mercadopago), usando los clientes
 * `Preference`, `PreApproval`, `PreApprovalPlan` y `Payment`.
 *
 * Ventajas vs. `fetch` directo:
 * - URLs, headers y formato de request/response mantenidos oficialmente
 * - Endpoints correctos (ej: `POST /preapproval`, NO `/v1/preapprovals`)
 * - Manejo de errores tipado desde el SDK
 * - Facilita futuras integraciones (OAuth, customers, refunds, etc.)
 *
 * Sobre el flag `MERCADOPAGO_SANDBOX`:
 * La API REST de MercadoPago siempre vive en `https://api.mercadopago.com`.
 * El "sandbox" se elige por el `access_token` (TEST-* vs APP_USR-*).
 * Cuando se está en sandbox, la respuesta trae `sandbox_init_point` y lo
 * preferimos por sobre `init_point` al redirigir al usuario.
 *
 * Flujo de suscripción sin plan asociado (pago pendiente):
 * 1. Backend crea un preapproval en MP con `status: 'pending'`
 * 2. MP devuelve un `init_point` (URL de checkout) que el usuario debe abrir
 * 3. El usuario paga en MP y es redirigido a `back_url`
 * 4. MP notifica al webhook; el backend actualiza la subscription
 *
 * Ref: https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments
 */
@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly isSandbox: boolean;
  private readonly currencyId: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(MERCADOPAGO_PREFERENCE_CLIENT)
    private readonly preferenceClient: Preference,
    @Inject(MERCADOPAGO_PRE_APPROVAL_CLIENT)
    private readonly preApprovalClient: PreApproval,
    @Inject(MERCADOPAGO_PRE_APPROVAL_PLAN_CLIENT)
    private readonly preApprovalPlanClient: PreApprovalPlan,
    @Inject(MERCADOPAGO_PAYMENT_CLIENT)
    private readonly paymentClient: Payment,
  ) {
    this.isSandbox =
      (this.configService.get<string>('MERCADOPAGO_SANDBOX') ?? 'false') ===
      'true';

    // Por defecto ARS. Configurable vía MERCADOPAGO_CURRENCY (ej: 'USD', 'MXN', 'BRL').
    // La API de MercadoPago rechaza monedas no habilitadas para la cuenta del vendedor.
    this.currencyId =
      this.configService.get<string>('MERCADOPAGO_CURRENCY') ?? 'ARS';
  }

  /**
   * Crea una preference de pago (para pago único / checkout pro).
   *
   * Endpoint SDK: `Preference.create({ body })`
   *   → internamente: `POST https://api.mercadopago.com/checkout/preferences`
   */
  async createPreference(params: {
    title: string;
    description: string;
    price: number;
    quantity: number;
    externalReference: string;
    payerEmail?: string;
  }): Promise<{ preferenceId: string; initPoint: string }> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const notificationUrl =
      this.configService.get<string>('MERCADOPAGO_NOTIFICATION_URL') ??
      this.buildNotificationUrl();

    // En sandbox de MercadoPago, `auto_return: 'approved'` frecuentemente se
    // rechaza con `invalid_auto_return` porque las back_urls en http://localhost
    // no son accesibles desde MP. Sólo activarlo cuando tengamos back_urls HTTPS
    // alcanzables (es decir, producción o cuando NO estamos en sandbox).
    const useAutoReturn = !this.isSandbox;

    const body = {
      items: [
        {
          // El SDK v3 exige `id` por item (es usado por MP para tracking).
          // Generamos uno determinístico basado en `externalReference`.
          id: params.externalReference,
          title: params.title,
          description: params.description,
          quantity: params.quantity,
          currency_id: this.currencyId,
          unit_price: params.price,
        },
      ],
      ...(params.payerEmail ? { payer: { email: params.payerEmail } } : {}),
      external_reference: params.externalReference,
      back_urls: {
        success: `${frontendUrl}/onboarding/success`,
        pending: `${frontendUrl}/onboarding/pending`,
        failure: `${frontendUrl}/onboarding/failure`,
      },
      ...(useAutoReturn ? { auto_return: 'approved' as const } : {}),
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      payment_methods: {
        excluded_payment_types: [{ id: 'cash' }],
      },
    };

    try {
      const idempotencyKey = `pref-${params.externalReference}-${randomUUID()}`;
      const response = await this.preferenceClient.create({
        body,
        requestOptions: { idempotencyKey },
      });

      // En sandbox el `sandbox_init_point` apunta al sitio sandbox;
      // en producción `init_point` apunta a www.mercadopago.com.
      const initPoint = this.isSandbox
        ? (response.sandbox_init_point ?? response.init_point ?? '')
        : (response.init_point ?? response.sandbox_init_point ?? '');

      return {
        preferenceId: response.id ?? '',
        initPoint,
      };
    } catch (error) {
      // Log estructurado para diagnóstico rápido en este flujo crítico
      this.logPreferenceError(error, body);
      throw error;
    }
  }

  private logPreferenceError(error: unknown, body: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const cause =
      typeof error === 'object' && error !== null && 'cause' in error
        ? (error as { cause?: unknown }).cause
        : undefined;
    this.logger.error(
      '[MercadoPagoService] createPreference failed',
      JSON.stringify({
        message,
        cause,
        isSandbox: this.isSandbox,
        currencyId: this.currencyId,
        bodyKeys: body && typeof body === 'object' ? Object.keys(body) : [],
      }),
    );
  }

  /**
   * Obtiene la información de un payment (cobro).
   *
   * Endpoint SDK: `Payment.get({ id })`
   *   → internamente: `GET https://api.mercadopago.com/v1/payments/:id`
   */
  async getPayment(paymentId: string): Promise<{
    id: string;
    status: 'approved' | 'pending' | 'rejected';
    externalReference: string | null;
    preferenceId: string | null;
    transactionAmount: number;
  }> {
    const response = (await this.paymentClient.get({
      id: paymentId,
    })) as unknown as PaymentResponseFromSdk;

    return {
      id: String(response.id ?? paymentId),
      status: this.mapPaymentStatus(response.status ?? ''),
      externalReference: response.external_reference ?? null,
      preferenceId: response.preference_id ?? null,
      transactionAmount: Number(response.transaction_amount ?? 0),
    };
  }

  /**
   * Crea un preapproval_plan (plan recurrente — plantila reutilizable).
   *
   * Endpoint SDK: `PreApprovalPlan.create({ body })`
   *   → internamente: `POST https://api.mercadopago.com/preapproval_plan`
   */
  async createPreapprovalPlan(params: {
    planName: string;
    price: number;
    billingPeriod: BillingPeriod;
  }): Promise<{ planId: string }> {
    const frequency = params.billingPeriod === BillingPeriod.MONTHLY ? 1 : 12;
    const frequency_type =
      params.billingPeriod === BillingPeriod.MONTHLY ? 'months' : 'years';

    const body = {
      reason: params.planName,
      auto_recurring: {
        frequency,
        frequency_type,
        transaction_amount: params.price,
        currency_id: this.currencyId,
        transactions_per_failure: 3,
        retry_attempts: 3,
      },
      payment_methods_allowed: {
        payment_types: [{ id: 'credit_card' }],
      },
    };

    const response = await this.preApprovalPlanClient.create({ body });
    return { planId: response.id ?? '' };
  }

  /**
   * Crea una suscripción sin plan asociado (pago pendiente).
   *
   * Endpoint SDK: `PreApproval.create({ body })`
   *   → internamente: `POST https://api.mercadopago.com/preapproval`
   *   (sin `/v1/` — ese era el bug del 404 con `fetch` directo)
   *
   * Ref: https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments
   *
   * Flujo:
   * 1. Backend crea preapproval con `status: 'pending'`
   * 2. MP devuelve `init_point` (URL del checkout) — el frontend redirige ahí
   * 3. El usuario completa el pago en MP
   * 4. MP redirige al usuario a `back_url`
   * 5. MP notifica al webhook; el backend actualiza la subscription
   */
  async createPreapproval(params: {
    planType: SubscriptionPlan;
    billingPeriod: BillingPeriod;
    payerEmail: string;
    tenantId: string;
  }): Promise<{
    externalSubscriptionId: string;
    initPoint: string;
    status: 'pending';
  }> {
    const price =
      PLAN_PRICING[params.planType]?.[
        params.billingPeriod === BillingPeriod.MONTHLY ? 'monthly' : 'yearly'
      ] ?? 0;

    const frequency = params.billingPeriod === BillingPeriod.MONTHLY ? 1 : 12;
    const frequency_type =
      params.billingPeriod === BillingPeriod.MONTHLY ? 'months' : 'years';

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    const billingLabel =
      params.billingPeriod === BillingPeriod.MONTHLY ? 'mensual' : 'anual';

    // Body según la doc oficial de "suscripciones sin plan asociado con pago pendiente":
    // - `payer_email` es un string plano (NO `payer: { email: ... }`)
    // - `frequency_type` es el nombre del campo
    // - `auto_recurring` requiere `transaction_amount` y `currency_id`
    const body = {
      reason: `Suscripción ${params.planType} - ${billingLabel}`,
      auto_recurring: {
        frequency,
        frequency_type,
        transaction_amount: price,
        currency_id: this.currencyId,
      },
      payer_email: params.payerEmail,
      back_url: `${frontendUrl}/payments/status`,
      external_reference: `tenant:${params.tenantId}`,
      status: 'pending' as const,
    };

    try {
      const idempotencyKey = `preapproval-${params.tenantId}-${randomUUID()}`;
      const response = (await this.preApprovalClient.create({
        body,
        requestOptions: { idempotencyKey },
      })) as PreapprovalResponse;

      // En sandbox el `sandbox_init_point` apunta al sitio sandbox;
      // en producción `init_point` apunta a www.mercadopago.com.
      const initPoint = this.isSandbox
        ? (response.sandbox_init_point ?? response.init_point ?? '')
        : (response.init_point ?? response.sandbox_init_point ?? '');

      return {
        externalSubscriptionId: response.id ?? '',
        initPoint,
        status: 'pending',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause =
        typeof error === 'object' && error !== null && 'cause' in error
          ? (error as { cause?: unknown }).cause
          : undefined;
      this.logger.error(
        '[MercadoPagoService] createPreapproval failed',
        JSON.stringify({
          message,
          cause,
          isSandbox: this.isSandbox,
          currencyId: this.currencyId,
          body,
        }),
      );
      throw error;
    }
  }

  /**
   * Cancela un preapproval (suscripción).
   *
   * Endpoint SDK: `PreApproval.update({ id, body: { status: 'cancelled' } })`
   *   → internamente: `PUT https://api.mercadopago.com/preapproval/:id`
   */
  async cancelPreapproval(externalSubscriptionId: string): Promise<boolean> {
    try {
      await this.preApprovalClient.update({
        id: externalSubscriptionId,
        body: { status: 'cancelled' },
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `[MercadoPagoService] cancelPreapproval failed (id=${externalSubscriptionId})`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Obtiene el estado de un preapproval.
   *
   * Endpoint SDK: `PreApproval.get({ id })`
   */
  async getPreapprovalStatus(externalSubscriptionId: string): Promise<{
    status:
      | 'pending'
      | 'active'
      | 'cancelled'
      | 'paused'
      | 'expired'
      | 'authorized';
    dateCreated: Date;
    nextBillingDate: Date;
    lastBillingDate: Date;
  }> {
    const response = (await this.preApprovalClient.get({
      id: externalSubscriptionId,
    })) as PreapprovalResponse;

    return {
      status: this.mapMpStatus(response.status ?? ''),
      dateCreated: this.parseDate(response.date_created),
      nextBillingDate: this.parseDate(response.next_payment_date),
      lastBillingDate: this.parseDate(response.date_created),
    };
  }

  /**
   * Obtiene el estado de un preapproval por su ID (usado desde webhooks).
   * Devuelve también el `external_reference` para correlacionar la
   * suscripción interna.
   */
  async getPreapprovalById(preapprovalId: string): Promise<{
    id: string;
    status:
      | 'pending'
      | 'active'
      | 'cancelled'
      | 'paused'
      | 'expired'
      | 'authorized';
    dateCreated: Date;
    nextBillingDate: Date;
    lastBillingDate: Date;
    externalReference: string | null;
  }> {
    const response = (await this.preApprovalClient.get({
      id: preapprovalId,
    })) as PreapprovalResponse;

    return {
      id: response.id ?? preapprovalId,
      status: this.mapMpStatus(response.status ?? ''),
      dateCreated: this.parseDate(response.date_created),
      nextBillingDate: this.parseDate(response.next_payment_date),
      lastBillingDate: this.parseDate(response.date_created),
      externalReference: response.external_reference ?? null,
    };
  }

  /**
   * Procesa un cobro recurrente manualmente.
   *
   * NOTA: MP procesa cobros automáticamente según el `auto_recurring` del
   * preapproval. Este método se conserva por simetría de la API pública, pero
   * simplemente reporta que el cobro no es manual.
   */
  async chargeRecurring(externalSubscriptionId: string): Promise<{
    success: boolean;
    paymentId?: string;
    error?: string;
  }> {
    try {
      const preapproval = await this.getPreapprovalStatus(
        externalSubscriptionId,
      );

      if (preapproval.status !== 'active') {
        return {
          success: false,
          error: `La suscripción no está activa (status: ${preapproval.status})`,
        };
      }

      return {
        success: false,
        error:
          'Los cobros recurrentes se procesan automáticamente via auto_recurring de MP. Use cancelPreapproval para cancelar.',
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error desconocido al procesar cobro',
      };
    }
  }

  /**
   * Mapa de statuses de MP a nuestros statuses internos.
   * Importante: "authorized" es el status de MP cuando el pago pendiente
   * fue aprobado. Luego MP lo transiciona a "active" automáticamente.
   */
  private mapMpStatus(
    mpStatus: string,
  ): 'pending' | 'active' | 'cancelled' | 'paused' | 'expired' | 'authorized' {
    const statusMap: Record<
      string,
      'pending' | 'active' | 'cancelled' | 'paused' | 'expired' | 'authorized'
    > = {
      pending: 'pending',
      authorized: 'authorized',
      active: 'active',
      cancelled: 'cancelled',
      paused: 'paused',
      expired: 'expired',
    };
    return statusMap[mpStatus] ?? 'pending';
  }

  private mapPaymentStatus(
    mpStatus: string,
  ): 'approved' | 'pending' | 'rejected' {
    if (mpStatus === 'approved') return 'approved';
    if (mpStatus === 'rejected' || mpStatus === 'cancelled') return 'rejected';
    return 'pending';
  }

  private parseDate(value: string | undefined | null): Date {
    if (!value) return new Date();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private buildNotificationUrl(): string | null {
    const backendPublicUrl =
      this.configService.get<string>('BACKEND_PUBLIC_URL') ??
      this.configService.get<string>('BACKEND_URL');
    if (!backendPublicUrl) return null;
    return `${backendPublicUrl.replace(/\/$/, '')}/api/webhooks/mercadopago`;
  }
}

/**
 * Provider factory que construye una `MercadoPagoConfig` a partir del token
 * configurado en `ConfigService`. Usada por los factories de cada cliente
 * del SDK.
 */
export const buildMercadoPagoConfig = (
  configService: ConfigService,
): MercadoPagoConfig => {
  const accessToken =
    configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') ?? '';
  return new MercadoPagoConfig({ accessToken });
};

/**
 * El tipado de `PaymentResponse` que expone `mercadopago@3.x` no declara los
 * campos `external_reference`, `preference_id`, ni `transaction_amount`, pero
 * la API real de MercadoPago siempre los devuelve. Este tipo los proyecta
 * explícitamente para que `getPayment` pueda leerlos sin castings ruidosos.
 */
type PaymentResponseFromSdk = {
  id?: number;
  status?: string;
  external_reference?: string | null;
  preference_id?: string | null;
  transaction_amount?: number;
} & Record<string, unknown>;
