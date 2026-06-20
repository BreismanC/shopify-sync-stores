import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SubscriptionPlan,
  PLAN_PRICING,
} from '../../domain/enums/subscription-plan.enum';
import { BillingPeriod } from '../../domain/enums/billing-period.enum';

/**
 * MercadoPago Service — REST API integration (no SDK MCP)
 *
 * Flujo de card tokenization:
 * 1. Frontend usa SDK (@mercadopago/sdk-react-core) para generar card_token en el browser
 * 2. Frontend envía card_token_id al backend
 * 3. Backend crea preapproval en MP con card_token_id
 * 4. MP procesa el primer cobro y guarda payment_method para cobros futuros
 * 5. Webhook recibe notificación y actualiza la subscription
 *
 * URLs según ambiente:
 * - Sandbox: https://sandbox.mercadopago.com
 * - Producción: https://api.mercadopago.com
 */
@Injectable()
export class MercadoPagoService {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(private readonly configService: ConfigService) {
    const isSandbox =
      this.configService.get<string>('MERCADOPAGO_SANDBOX') === 'true';
    this.baseUrl = isSandbox
      ? 'https://sandbox.mercadopago.com'
      : 'https://api.mercadopago.com';
    this.accessToken =
      this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') ?? '';
  }

  /**
   * Crea una preference de pago (para pago único / checkout pro)
   * POST /v1/preferences
   */
  async createPreference(params: {
    title: string;
    description: string;
    price: number;
    quantity: number;
    externalReference: string;
  }): Promise<{ preferenceId: string; initPoint: string }> {
    const body = {
      items: [
        {
          title: params.title,
          description: params.description,
          quantity: params.quantity,
          currency_id: 'USD',
          unit_price: params.price,
        },
      ],
      external_reference: params.externalReference,
      payment_methods: {
        excluded_payment_types: [{ id: 'cash' }],
      },
    };

    const response = await this.mpFetch<{ id: string; init_point: string }>(
      '/v1/preferences',
      {
        method: 'POST',
        body,
      },
    );

    return {
      preferenceId: response.id,
      initPoint: response.init_point,
    };
  }

  /**
   * Crea un preapproval_plan (plan recurrente)
   * POST /v1/preapproval_plans
   */
  async createPreapprovalPlan(params: {
    planName: string;
    price: number;
    billingPeriod: BillingPeriod;
  }): Promise<{ planId: string }> {
    const frequency = params.billingPeriod === BillingPeriod.MONTHLY ? 1 : 12;
    const frequency_unit =
      params.billingPeriod === BillingPeriod.MONTHLY ? 'months' : 'years';

    const body = {
      description: params.planName,
      auto_recurring: {
        frequency,
        frequency_unit,
        transactions_per_failure: 3,
        retry_attempts: 3,
      },
      payment_methods_allowed: {
        payment_types: [{ id: 'credit_card' }],
      },
    };

    const response = await this.mpFetch<{ id: string }>(
      '/v1/preapproval_plans',
      {
        method: 'POST',
        body,
      },
    );

    return { planId: response.id };
  }

  /**
   * Crea un preapproval (suscripción con card_token del frontend)
   * POST /v1/preapprovals
   *
   * Flujo:
   * 1. Frontend genera card_token via SDK (@mercadopago/sdk-react-core)
   * 2. Frontend envía card_token_id al backend
   * 3. Backend crea preapproval con card_token_id
   * 4. MP procesa el primer cobro inmediatamente
   * 5. Si es exitoso, guarda el payment_method para cobros futuros
   */
  async createPreapproval(params: {
    planType: SubscriptionPlan;
    billingPeriod: BillingPeriod;
    cardTokenId: string;
    payerEmail: string;
    tenantId: string;
  }): Promise<{
    externalSubscriptionId: string;
    initPoint: string;
    status: 'pending' | 'active';
  }> {
    const price =
      PLAN_PRICING[params.planType]?.[
        params.billingPeriod === BillingPeriod.MONTHLY ? 'monthly' : 'yearly'
      ] ?? 0;

    const frequency = params.billingPeriod === BillingPeriod.MONTHLY ? 1 : 12;
    const frequency_unit =
      params.billingPeriod === BillingPeriod.MONTHLY ? 'months' : 'years';

    const body = {
      preapproval_plan_id: params.planType,
      payer: {
        email: params.payerEmail,
      },
      card_token_id: params.cardTokenId,
      auto_recurring: {
        frequency,
        frequency_unit,
        start_date: new Date().toISOString(),
        end_date: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      external_reference: params.tenantId,
      reason: `Suscripción ${params.planType} - ${params.billingPeriod === BillingPeriod.MONTHLY ? 'mensual' : 'anual'}`,
      status: 'pending',
    };

    interface PreapprovalResponse {
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
      status: string;
    }

    const response = await this.mpFetch<PreapprovalResponse>(
      '/v1/preapprovals',
      {
        method: 'POST',
        body,
      },
    );

    return {
      externalSubscriptionId: response.id,
      initPoint: response.init_point ?? response.sandbox_init_point ?? '',
      status: response.status === 'active' ? 'active' : 'pending',
    };
  }

  /**
   * Cancela un preapproval (suscripción)
   * PUT /v1/preapprovals/{id}
   */
  async cancelPreapproval(externalSubscriptionId: string): Promise<boolean> {
    try {
      await this.mpFetch(`/v1/preapprovals/${externalSubscriptionId}`, {
        method: 'PUT',
        body: {
          status: 'cancelled',
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene el estado de un preapproval
   * GET /v1/preapprovals/{id}
   */
  async getPreapprovalStatus(externalSubscriptionId: string): Promise<{
    status: 'pending' | 'active' | 'cancelled' | 'paused' | 'expired';
    dateCreated: Date;
    nextBillingDate: Date;
    lastBillingDate: Date;
  }> {
    interface StatusResponse {
      status: string;
      date_created: string;
      next_billing_date: string;
      last_billing_date: string;
    }

    const response = await this.mpFetch<StatusResponse>(
      `/v1/preapprovals/${externalSubscriptionId}`,
      {
        method: 'GET',
      },
    );

    return {
      status: this.mapMpStatus(response.status),
      dateCreated: new Date(response.date_created),
      nextBillingDate: response.next_billing_date
        ? new Date(response.next_billing_date)
        : new Date(),
      lastBillingDate: response.last_billing_date
        ? new Date(response.last_billing_date)
        : new Date(),
    };
  }

  /**
   * Procesa un cobro recurrente manualmente
   *
   * NOTA: MP procesa cobros automáticamente según el preapproval_plan.
   * Este método es para forzar un cobro fuera del ciclo normal si es necesario.
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
   * Mapa de statuses de MP a nuestros statuses internos
   */
  private mapMpStatus(
    mpStatus: string,
  ): 'pending' | 'active' | 'cancelled' | 'paused' | 'expired' {
    const statusMap: Record<
      string,
      'pending' | 'active' | 'cancelled' | 'paused' | 'expired'
    > = {
      pending: 'pending',
      active: 'active',
      cancelled: 'cancelled',
      paused: 'paused',
      expired: 'expired',
    };
    return statusMap[mpStatus] ?? 'pending';
  }

  /**
   * Wrapper para fetch con autenticación y manejo de errores
   */
  private async mpFetch<T = Record<string, unknown>>(
    endpoint: string,
    options: {
      method: string;
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method: options.method,
      headers,
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `MercadoPago API error: ${response.status} - ${errorBody}`,
      );
    }

    return response.json() as Promise<T>;
  }
}
