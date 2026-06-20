import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoService } from './mercadopago.service';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';
import { BillingPeriod } from '../../domain/enums/billing-period.enum';

describe('MercadoPagoService', () => {
  let mercadopagoService: MercadoPagoService;
  let configService: jest.Mocked<ConfigService>;

  const mockFetch = jest.fn();

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          MERCADOPAGO_SANDBOX: 'false',
          MERCADOPAGO_ACCESS_TOKEN: 'TEST_ACCESS_TOKEN',
        };
        return config[key];
      }),
    } as any;

    // Replace global fetch with mock
    global.fetch = mockFetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MercadoPagoService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    mercadopagoService = module.get<MercadoPagoService>(MercadoPagoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPreference', () => {
    it('should create a payment preference and return preferenceId and initPoint', async () => {
      const mockResponse = {
        id: 'pref-123456',
        init_point: 'https://www.mercadopago.com/checkout/start?pref=123456',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await mercadopagoService.createPreference({
        title: 'Plan BASIC Mensual',
        description: 'Suscripción mensual al plan BASIC',
        price: 29,
        quantity: 1,
        externalReference: 'tenant-uuid',
      });

      expect(result.preferenceId).toBe('pref-123456');
      expect(result.initPoint).toBe(
        'https://www.mercadopago.com/checkout/start?pref=123456',
      );

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.mercadopago.com/v1/preferences');
      expect(fetchCall[1].method).toBe('POST');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Plan BASIC Mensual',
            quantity: 1,
            unit_price: 29,
          }),
        ]),
      );
      expect(body.external_reference).toBe('tenant-uuid');
    });

    it('should throw error when MercadoPago API returns non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(
        mercadopagoService.createPreference({
          title: 'Test',
          description: 'Test',
          price: 10,
          quantity: 1,
          externalReference: 'ref',
        }),
      ).rejects.toThrow('MercadoPago API error: 401 - Unauthorized');
    });
  });

  describe('createPreapprovalPlan', () => {
    it('should create a preapproval plan for monthly billing', async () => {
      const mockResponse = { id: 'plan-123456' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await mercadopagoService.createPreapprovalPlan({
        planName: 'Plan PRO',
        price: 79,
        billingPeriod: BillingPeriod.MONTHLY,
      });

      expect(result.planId).toBe('plan-123456');
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe(
        'https://api.mercadopago.com/v1/preapproval_plans',
      );
      expect(fetchCall[1].method).toBe('POST');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.description).toBe('Plan PRO');
      expect(body.auto_recurring.frequency).toBe(1);
      expect(body.auto_recurring.frequency_unit).toBe('months');
    });

    it('should create a preapproval plan for yearly billing', async () => {
      const mockResponse = { id: 'plan-789' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await mercadopagoService.createPreapprovalPlan({
        planName: 'Plan ENTERPRISE',
        price: 1990,
        billingPeriod: BillingPeriod.YEARLY,
      });

      expect(result.planId).toBe('plan-789');
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.auto_recurring.frequency).toBe(12);
      expect(body.auto_recurring.frequency_unit).toBe('years');
    });
  });

  describe('createPreapproval', () => {
    it('should create a preapproval subscription with card_token_id', async () => {
      const mockResponse = {
        id: 'preapproval-123',
        init_point: 'https://www.mercadopago.com/preapproval?pref=123',
        sandbox_init_point:
          'https://sandbox.mercadopago.com/preapproval?pref=123',
        status: 'pending',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await mercadopagoService.createPreapproval({
        planType: SubscriptionPlan.BASIC,
        billingPeriod: BillingPeriod.MONTHLY,
        cardTokenId: 'card-token-xyz',
        payerEmail: 'user@example.com',
        tenantId: 'tenant-uuid',
      });

      expect(result.externalSubscriptionId).toBe('preapproval-123');
      expect(result.status).toBe('pending');
      // MERCADOPAGO_SANDBOX=false returns init_point (production URL), not sandbox_init_point
      expect(result.initPoint).toContain('mercadopago.com/preapproval');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.mercadopago.com/v1/preapprovals');
      expect(fetchCall[1].method).toBe('POST');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.card_token_id).toBe('card-token-xyz');
      expect(body.payer.email).toBe('user@example.com');
      expect(body.auto_recurring.frequency).toBe(1);
      expect(body.auto_recurring.frequency_unit).toBe('months');
      expect(body.external_reference).toBe('tenant-uuid');
    });

    it('should map active status from MercadoPago response', async () => {
      const mockResponse = {
        id: 'preapproval-active',
        init_point: 'https://www.mercadopago.com/preapproval',
        status: 'active',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await mercadopagoService.createPreapproval({
        planType: SubscriptionPlan.PRO,
        billingPeriod: BillingPeriod.YEARLY,
        cardTokenId: 'card-token-789',
        payerEmail: 'pro@example.com',
        tenantId: 'tenant-uuid',
      });

      expect(result.status).toBe('active');
    });
  });

  describe('cancelPreapproval', () => {
    it('should return true when cancellation succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'cancelled' }),
      });

      const result =
        await mercadopagoService.cancelPreapproval('preapproval-123');

      expect(result).toBe(true);
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe(
        'https://api.mercadopago.com/v1/preapprovals/preapproval-123',
      );
      expect(fetchCall[1].method).toBe('PUT');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.status).toBe('cancelled');
    });

    it('should return false when cancellation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      const result = await mercadopagoService.cancelPreapproval('invalid-id');

      expect(result).toBe(false);
    });
  });

  describe('getPreapprovalStatus', () => {
    it('should return mapped status and dates from MercadoPago', async () => {
      const mockResponse = {
        status: 'active',
        date_created: '2024-01-15T10:00:00.000Z',
        next_billing_date: '2024-02-15T10:00:00.000Z',
        last_billing_date: '2024-01-15T10:00:00.000Z',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result =
        await mercadopagoService.getPreapprovalStatus('preapproval-123');

      expect(result.status).toBe('active');
      expect(result.dateCreated).toEqual(new Date('2024-01-15T10:00:00.000Z'));
      expect(result.nextBillingDate).toEqual(
        new Date('2024-02-15T10:00:00.000Z'),
      );
      expect(result.lastBillingDate).toEqual(
        new Date('2024-01-15T10:00:00.000Z'),
      );
    });

    it('should map all MercadoPago statuses correctly', async () => {
      const statusTestCases: Array<{
        mpStatus: string;
        expectedStatus: string;
      }> = [
        { mpStatus: 'pending', expectedStatus: 'pending' },
        { mpStatus: 'active', expectedStatus: 'active' },
        { mpStatus: 'cancelled', expectedStatus: 'cancelled' },
        { mpStatus: 'paused', expectedStatus: 'paused' },
        { mpStatus: 'expired', expectedStatus: 'expired' },
      ];

      for (const { mpStatus, expectedStatus } of statusTestCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              status: mpStatus,
              date_created: '2024-01-15T10:00:00.000Z',
              next_billing_date: '2024-02-15T10:00:00.000Z',
              last_billing_date: '2024-01-15T10:00:00.000Z',
            }),
        });

        const result =
          await mercadopagoService.getPreapprovalStatus('preapproval-123');
        expect(result.status).toBe(expectedStatus);
      }
    });

    it('should default to pending for unknown statuses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'unknown_status',
            date_created: '2024-01-15T10:00:00.000Z',
            next_billing_date: '2024-02-15T10:00:00.000Z',
            last_billing_date: '2024-01-15T10:00:00.000Z',
          }),
      });

      const result =
        await mercadopagoService.getPreapprovalStatus('preapproval-123');
      expect(result.status).toBe('pending');
    });
  });

  describe('chargeRecurring', () => {
    it('should return error when subscription is not active', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'pending',
            date_created: '2024-01-15T10:00:00.000Z',
            next_billing_date: '2024-02-15T10:00:00.000Z',
            last_billing_date: '2024-01-15T10:00:00.000Z',
          }),
      });

      const result =
        await mercadopagoService.chargeRecurring('preapproval-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('no está activa');
    });

    it('should return informative message about auto_recurring nature', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'active',
            date_created: '2024-01-15T10:00:00.000Z',
            next_billing_date: '2024-02-15T10:00:00.000Z',
            last_billing_date: '2024-01-15T10:00:00.000Z',
          }),
      });

      const result =
        await mercadopagoService.chargeRecurring('preapproval-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('auto_recurring');
    });
  });

  describe('sandbox mode', () => {
    it('should use sandbox URL when MERCADOPAGO_SANDBOX is true', async () => {
      configService.get = jest.fn((key: string) => {
        const config: Record<string, string> = {
          MERCADOPAGO_SANDBOX: 'true',
          MERCADOPAGO_ACCESS_TOKEN: 'TEST_TOKEN',
        };
        return config[key];
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MercadoPagoService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const sandboxService = module.get<MercadoPagoService>(MercadoPagoService);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'pref-123' }),
      });

      await sandboxService.createPreference({
        title: 'Test',
        description: 'Test',
        price: 10,
        quantity: 1,
        externalReference: 'ref',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sandbox.mercadopago.com/v1/preferences',
        expect.any(Object),
      );
    });
  });
});
