import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoService,
  MERCADOPAGO_PAYMENT_CLIENT,
  MERCADOPAGO_PREFERENCE_CLIENT,
  MERCADOPAGO_PRE_APPROVAL_CLIENT,
  MERCADOPAGO_PRE_APPROVAL_PLAN_CLIENT,
} from './mercadopago.service';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';
import { BillingPeriod } from '../../domain/enums/billing-period.enum';

type PreferenceClientMock = {
  create: jest.Mock;
};

type PreApprovalClientMock = {
  create: jest.Mock;
  update: jest.Mock;
  get: jest.Mock;
};

type PreApprovalPlanClientMock = {
  create: jest.Mock;
};

type PaymentClientMock = {
  get: jest.Mock;
};

describe('MercadoPagoService (SDK v3)', () => {
  let service: MercadoPagoService;
  let preference: PreferenceClientMock;
  let preApproval: PreApprovalClientMock;
  let preApprovalPlan: PreApprovalPlanClientMock;
  let payment: PaymentClientMock;

  const baseConfig: Record<string, string> = {
    MERCADOPAGO_SANDBOX: 'false',
    MERCADOPAGO_ACCESS_TOKEN: 'TEST_ACCESS_TOKEN',
  };

  const buildConfigService = (
    overrides: Record<string, string> = {},
  ): Partial<ConfigService> => ({
    get: (key: string) => ({ ...baseConfig, ...overrides })[key],
  });

  const buildTestModule = async (
    configOverrides: Record<string, string> = {},
  ): Promise<TestingModule> => {
    const preferenceMock: PreferenceClientMock = { create: jest.fn() };
    const preApprovalMock: PreApprovalClientMock = {
      create: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
    };
    const preApprovalPlanMock: PreApprovalPlanClientMock = {
      create: jest.fn(),
    };
    const paymentMock: PaymentClientMock = { get: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MercadoPagoService,
        { provide: ConfigService, useValue: buildConfigService(configOverrides) },
        {
          provide: MERCADOPAGO_PREFERENCE_CLIENT,
          useValue: preferenceMock,
        },
        {
          provide: MERCADOPAGO_PRE_APPROVAL_CLIENT,
          useValue: preApprovalMock,
        },
        {
          provide: MERCADOPAGO_PRE_APPROVAL_PLAN_CLIENT,
          useValue: preApprovalPlanMock,
        },
        {
          provide: MERCADOPAGO_PAYMENT_CLIENT,
          useValue: paymentMock,
        },
      ],
    }).compile();

    // Exponer los mocks vía la referencia del módulo para que cada test
    // pueda asignarlos a variables locales y configurarlos.
    (moduleRef as unknown as {
      __mocks: {
        preference: PreferenceClientMock;
        preApproval: PreApprovalClientMock;
        preApprovalPlan: PreApprovalPlanClientMock;
        payment: PaymentClientMock;
      };
    }).__mocks = {
      preference: preferenceMock,
      preApproval: preApprovalMock,
      preApprovalPlan: preApprovalPlanMock,
      payment: paymentMock,
    };

    return moduleRef;
  };

  beforeEach(async () => {
    const moduleRef = await buildTestModule();
    service = moduleRef.get<MercadoPagoService>(MercadoPagoService);
    const mocks = (
      moduleRef as unknown as {
        __mocks: {
          preference: PreferenceClientMock;
          preApproval: PreApprovalClientMock;
          preApprovalPlan: PreApprovalPlanClientMock;
          payment: PaymentClientMock;
        };
      }
    ).__mocks;
    preference = mocks.preference;
    preApproval = mocks.preApproval;
    preApprovalPlan = mocks.preApprovalPlan;
    payment = mocks.payment;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPreference', () => {
    it('debe invocar Preference.create con el body correcto y devolver preferenceId + initPoint', async () => {
      const sdkResponse = {
        id: 'pref-123456',
        init_point:
          'https://www.mercadopago.com/checkout/start?pref=123456',
      };
      preference.create.mockResolvedValueOnce(sdkResponse);

      const result = await service.createPreference({
        title: 'Plan BASIC Mensual',
        description: 'Suscripción mensual al plan BASIC',
        price: 29_000,
        quantity: 1,
        externalReference: 'tenant-uuid',
      });

      expect(result.preferenceId).toBe('pref-123456');
      expect(result.initPoint).toBe(
        'https://www.mercadopago.com/checkout/start?pref=123456',
      );

      expect(preference.create).toHaveBeenCalledTimes(1);
      const call = preference.create.mock.calls[0][0];
      expect(call.body.items).toEqual([
        expect.objectContaining({
          id: 'tenant-uuid',
          title: 'Plan BASIC Mensual',
          quantity: 1,
          currency_id: 'ARS',
          unit_price: 29_000,
        }),
      ]);
      expect(call.body.external_reference).toBe('tenant-uuid');
      // En producción (no-sandbox) sí se envía auto_return
      expect(call.body.auto_return).toBe('approved');
      expect(call.body.back_urls.success).toBeDefined();
      // Se debe enviar una idempotency key por request
      expect(call.requestOptions?.idempotencyKey).toMatch(/^pref-tenant-uuid-/);
    });

    it('debe omitir auto_return cuando MERCADOPAGO_SANDBOX=true', async () => {
      const moduleRef = await buildTestModule({ MERCADOPAGO_SANDBOX: 'true' });
      const sandboxService = moduleRef.get<MercadoPagoService>(
        MercadoPagoService,
      );
      const sandboxPreference = (
        moduleRef as unknown as { __mocks: { preference: PreferenceClientMock } }
      ).__mocks.preference;
      sandboxPreference.create.mockResolvedValueOnce({
        id: 'pref-123',
        sandbox_init_point: 'https://sandbox.mercadopago.com/checkout',
      });

      await sandboxService.createPreference({
        title: 'Test',
        description: 'Test',
        price: 10,
        quantity: 1,
        externalReference: 'ref',
      });

      const call = sandboxPreference.create.mock.calls[0][0];
      expect(call.body.auto_return).toBeUndefined();
      expect(call.body.back_urls.success).toBeDefined();
    });

    it('debe preferir sandbox_init_point cuando MERCADOPAGO_SANDBOX=true', async () => {
      const moduleRef = await buildTestModule({ MERCADOPAGO_SANDBOX: 'true' });
      const sandboxService = moduleRef.get<MercadoPagoService>(
        MercadoPagoService,
      );
      const sandboxPreference = (
        moduleRef as unknown as { __mocks: { preference: PreferenceClientMock } }
      ).__mocks.preference;
      sandboxPreference.create.mockResolvedValueOnce({
        id: 'pref-xyz',
        init_point: 'https://www.mercadopago.com/checkout/v1/redirect?pref=xyz',
        sandbox_init_point:
          'https://sandbox.mercadopago.com/checkout/v1/redirect?pref=xyz',
      });

      const result = await sandboxService.createPreference({
        title: 'Test',
        description: 'Test',
        price: 10,
        quantity: 1,
        externalReference: 'ref',
      });

      expect(result.initPoint).toBe(
        'https://sandbox.mercadopago.com/checkout/v1/redirect?pref=xyz',
      );
    });

    it('debe lanzar error y loguear cuando el SDK rechaza la preference', async () => {
      const sdkError = new Error('MercadoPago SDK error: 401 - Unauthorized');
      preference.create.mockRejectedValueOnce(sdkError);

      // Capturamos el log para verificar que no crashea
      const logSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);

      await expect(
        service.createPreference({
          title: 'Test',
          description: 'Test',
          price: 10,
          quantity: 1,
          externalReference: 'ref',
        }),
      ).rejects.toBe(sdkError);

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe('createPreapprovalPlan', () => {
    it('debe crear plan mensual con frequency_type=months', async () => {
      preApprovalPlan.create.mockResolvedValueOnce({ id: 'plan-123456' });

      const result = await service.createPreapprovalPlan({
        planName: 'Plan PRO',
        price: 79_000,
        billingPeriod: BillingPeriod.MONTHLY,
      });

      expect(result.planId).toBe('plan-123456');
      const call = preApprovalPlan.create.mock.calls[0][0];
      expect(call.body.reason).toBe('Plan PRO');
      expect(call.body.auto_recurring.frequency).toBe(1);
      expect(call.body.auto_recurring.frequency_type).toBe('months');
      expect(call.body.auto_recurring.transaction_amount).toBe(79_000);
      expect(call.body.auto_recurring.currency_id).toBe('ARS');
    });

    it('debe crear plan anual con frequency_type=years', async () => {
      preApprovalPlan.create.mockResolvedValueOnce({ id: 'plan-789' });

      const result = await service.createPreapprovalPlan({
        planName: 'Plan ENTERPRISE',
        price: 2_029_800,
        billingPeriod: BillingPeriod.YEARLY,
      });

      expect(result.planId).toBe('plan-789');
      const call = preApprovalPlan.create.mock.calls[0][0];
      expect(call.body.auto_recurring.frequency).toBe(12);
      expect(call.body.auto_recurring.frequency_type).toBe('years');
      expect(call.body.auto_recurring.transaction_amount).toBe(2_029_800);
    });
  });

  describe('createPreapproval', () => {
    it('debe crear el preapproval contra POST /preapproval (NO /v1/preapprovals) — bug que causaba 404', async () => {
      preApproval.create.mockResolvedValueOnce({
        id: 'preapproval-123',
        init_point: 'https://www.mercadopago.com/preapproval?pref=123',
        sandbox_init_point:
          'https://sandbox.mercadopago.com/preapproval?pref=123',
        status: 'pending',
      });

      const result = await service.createPreapproval({
        planType: SubscriptionPlan.BASIC,
        billingPeriod: BillingPeriod.MONTHLY,
        payerEmail: 'user@example.com',
        tenantId: 'tenant-uuid',
      });

      expect(result.externalSubscriptionId).toBe('preapproval-123');
      expect(result.status).toBe('pending');
      // MERCADOPAGO_SANDBOX=false (default) → init_point de producción
      expect(result.initPoint).toContain('mercadopago.com/preapproval');

      const call = preApproval.create.mock.calls[0][0];
      expect(call.body.payer_email).toBe('user@example.com');
      expect((call.body as Record<string, unknown>).payer).toBeUndefined();
      expect(call.body.auto_recurring.frequency).toBe(1);
      expect(call.body.auto_recurring.frequency_type).toBe('months');
      expect(
        (call.body.auto_recurring as Record<string, unknown>).frequency_unit,
      ).toBeUndefined();
      expect(call.body.auto_recurring.transaction_amount).toBe(29_000);
      expect(call.body.auto_recurring.currency_id).toBe('ARS');
      expect(call.body.external_reference).toBe('tenant:tenant-uuid');
      expect(call.body.status).toBe('pending');
      expect(call.body.reason).toContain('BASIC');
      // Idempotency key
      expect(call.requestOptions?.idempotencyKey).toMatch(
        /^preapproval-tenant-uuid-/,
      );
    });

    it('debe usar frequency_type=years y transaction_amount correcto para YEARLY', async () => {
      preApproval.create.mockResolvedValueOnce({
        id: 'preapproval-2',
        init_point: 'https://example.com',
      });

      await service.createPreapproval({
        planType: SubscriptionPlan.PRO,
        billingPeriod: BillingPeriod.YEARLY,
        payerEmail: 'pro@example.com',
        tenantId: 'tenant-uuid',
      });

      const call = preApproval.create.mock.calls[0][0];
      expect(call.body.auto_recurring.frequency).toBe(12);
      expect(call.body.auto_recurring.frequency_type).toBe('years');
      expect(call.body.auto_recurring.transaction_amount).toBe(805_800);
    });

    it('debe preferir sandbox_init_point cuando MERCADOPAGO_SANDBOX=true', async () => {
      const moduleRef = await buildTestModule({ MERCADOPAGO_SANDBOX: 'true' });
      const sandboxService = moduleRef.get<MercadoPagoService>(
        MercadoPagoService,
      );
      const sandboxPreApproval = (
        moduleRef as unknown as { __mocks: { preApproval: PreApprovalClientMock } }
      ).__mocks.preApproval;
      sandboxPreApproval.create.mockResolvedValueOnce({
        id: 'preapproval-abc',
        init_point: 'https://www.mercadopago.com/checkout/v1/redirect?pref=abc',
        sandbox_init_point:
          'https://sandbox.mercadopago.com/checkout/v1/redirect?pref=abc',
      });

      const result = await sandboxService.createPreapproval({
        planType: SubscriptionPlan.BASIC,
        billingPeriod: BillingPeriod.MONTHLY,
        payerEmail: 'user@example.com',
        tenantId: 'tenant-uuid',
      });

      expect(result.initPoint).toBe(
        'https://sandbox.mercadopago.com/checkout/v1/redirect?pref=abc',
      );
    });

    it('debe loguear y re-lanzar el error si el SDK falla', async () => {
      const sdkError = new Error('SDK createPreapproval failed');
      preApproval.create.mockRejectedValueOnce(sdkError);

      const logSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);

      await expect(
        service.createPreapproval({
          planType: SubscriptionPlan.BASIC,
          billingPeriod: BillingPeriod.MONTHLY,
          payerEmail: 'user@example.com',
          tenantId: 'tenant-uuid',
        }),
      ).rejects.toBe(sdkError);

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe('cancelPreapproval', () => {
    it('debe invocar PreApproval.update con status=cancelled', async () => {
      preApproval.update.mockResolvedValueOnce({ status: 'cancelled' });

      const result = await service.cancelPreapproval('preapproval-123');

      expect(result).toBe(true);
      expect(preApproval.update).toHaveBeenCalledWith({
        id: 'preapproval-123',
        body: { status: 'cancelled' },
      });
    });

    it('debe devolver false si la cancelación falla', async () => {
      preApproval.update.mockRejectedValueOnce(new Error('404'));

      const result = await service.cancelPreapproval('invalid-id');

      expect(result).toBe(false);
    });
  });

  describe('getPayment', () => {
    it('debe devolver payment mapeado', async () => {
      payment.get.mockResolvedValueOnce({
        id: 12345,
        status: 'approved',
        external_reference: 'tenant-uuid',
        preference_id: 'pref-123',
        transaction_amount: 29_000,
      });

      const result = await service.getPayment('12345');

      expect(result).toEqual({
        id: '12345',
        status: 'approved',
        externalReference: 'tenant-uuid',
        preferenceId: 'pref-123',
        transactionAmount: 29_000,
      });
      expect(payment.get).toHaveBeenCalledWith({ id: '12345' });
    });

    it('debe normalizar status (cancelled → rejected)', async () => {
      payment.get.mockResolvedValueOnce({
        id: 1,
        status: 'cancelled',
      });

      const result = await service.getPayment('1');
      expect(result.status).toBe('rejected');
    });
  });

  describe('getPreapprovalStatus', () => {
    it('debe mapear el status y parsear las fechas', async () => {
      preApproval.get.mockResolvedValueOnce({
        id: 'preapproval-123',
        status: 'active',
        date_created: '2024-01-15T10:00:00.000Z',
        next_payment_date: '2024-02-15T10:00:00.000Z',
      });

      const result = await service.getPreapprovalStatus('preapproval-123');

      expect(result.status).toBe('active');
      expect(result.dateCreated).toEqual(new Date('2024-01-15T10:00:00.000Z'));
      expect(result.nextBillingDate).toEqual(
        new Date('2024-02-15T10:00:00.000Z'),
      );
      expect(preApproval.get).toHaveBeenCalledWith({ id: 'preapproval-123' });
    });

    it.each([
      ['pending', 'pending'],
      ['active', 'active'],
      ['cancelled', 'cancelled'],
      ['paused', 'paused'],
      ['expired', 'expired'],
    ])('debe mapear %s a %s', async (mpStatus, expected) => {
      preApproval.get.mockResolvedValueOnce({
        status: mpStatus,
        date_created: '2024-01-15T10:00:00.000Z',
        next_payment_date: '2024-02-15T10:00:00.000Z',
      });

      const result = await service.getPreapprovalStatus('preapproval-123');
      expect(result.status).toBe(expected);
    });

    it('debe devolver status "pending" ante un status desconocido', async () => {
      preApproval.get.mockResolvedValueOnce({
        status: 'unknown_status',
        date_created: '2024-01-15T10:00:00.000Z',
        next_payment_date: '2024-02-15T10:00:00.000Z',
      });

      const result = await service.getPreapprovalStatus('preapproval-123');
      expect(result.status).toBe('pending');
    });
  });

  describe('getPreapprovalById', () => {
    it('debe devolver id, status, fechas y externalReference', async () => {
      preApproval.get.mockResolvedValueOnce({
        id: 'preapproval-999',
        status: 'authorized',
        date_created: '2024-03-01T10:00:00.000Z',
        next_payment_date: '2024-04-01T10:00:00.000Z',
        external_reference: 'tenant:abc',
      });

      const result = await service.getPreapprovalById('preapproval-999');

      expect(result).toEqual({
        id: 'preapproval-999',
        status: 'authorized',
        dateCreated: new Date('2024-03-01T10:00:00.000Z'),
        nextBillingDate: new Date('2024-04-01T10:00:00.000Z'),
        lastBillingDate: new Date('2024-03-01T10:00:00.000Z'),
        externalReference: 'tenant:abc',
      });
    });

    it('debe devolver externalReference=null cuando no viene', async () => {
      preApproval.get.mockResolvedValueOnce({
        id: 'preapproval-xyz',
        status: 'pending',
        date_created: '2024-03-01T10:00:00.000Z',
        next_payment_date: null,
      });

      const result = await service.getPreapprovalById('preapproval-xyz');
      expect(result.externalReference).toBeNull();
      expect(result.nextBillingDate).toBeInstanceOf(Date);
    });
  });

  describe('chargeRecurring', () => {
    it('debe devolver error cuando la suscripción no está activa', async () => {
      preApproval.get.mockResolvedValueOnce({
        status: 'pending',
        date_created: '2024-01-15T10:00:00.000Z',
        next_payment_date: '2024-02-15T10:00:00.000Z',
      });

      const result = await service.chargeRecurring('preapproval-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('no está activa');
    });

    it('debe devolver mensaje informativo cuando la suscripción está activa', async () => {
      preApproval.get.mockResolvedValueOnce({
        status: 'active',
        date_created: '2024-01-15T10:00:00.000Z',
        next_payment_date: '2024-02-15T10:00:00.000Z',
      });

      const result = await service.chargeRecurring('preapproval-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('auto_recurring');
    });
  });

  describe('currency configuration', () => {
    it('debe usar ARS por defecto', async () => {
      preference.create.mockResolvedValueOnce({
        id: 'pref-ars',
        init_point: 'https://example.com/checkout',
      });

      await service.createPreference({
        title: 'Test',
        description: 'Test',
        price: 100,
        quantity: 1,
        externalReference: 'ref',
      });

      const call = preference.create.mock.calls[0][0];
      expect(call.body.items[0].currency_id).toBe('ARS');
    });

    it('debe respetar MERCADOPAGO_CURRENCY cuando está definido', async () => {
      const moduleRef = await buildTestModule({
        MERCADOPAGO_CURRENCY: 'USD',
      });
      const usdService = moduleRef.get<MercadoPagoService>(
        MercadoPagoService,
      );
      const usdPreference = (
        moduleRef as unknown as { __mocks: { preference: PreferenceClientMock } }
      ).__mocks.preference;
      usdPreference.create.mockResolvedValueOnce({
        id: 'pref-usd',
        init_point: 'https://example.com/checkout',
      });

      await usdService.createPreference({
        title: 'Test',
        description: 'Test',
        price: 10,
        quantity: 1,
        externalReference: 'ref',
      });

      const call = usdPreference.create.mock.calls[0][0];
      expect(call.body.items[0].currency_id).toBe('USD');
    });
  });
});
