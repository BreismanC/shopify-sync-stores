"use client";

import { useState } from 'react';
import { SubscriptionPlan, BillingPeriod } from '@shopify-sync/database/enums';
import { PLAN_PRICING } from './subscription-plans';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { BACKEND_URL } from '@/lib/env';

interface Props {
  planType: SubscriptionPlan;
  billingPeriod: BillingPeriod;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function PaymentForm({
  planType,
  billingPeriod,
  open,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [docType, setDocType] = useState('CC');
  const [docNumber, setDocNumber] = useState('');

  const price = PLAN_PRICING[planType][billingPeriod];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Load MercadoPago SDK
      const mercadopago = await import('@mercadopago/sdk-js');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mp = await mercadopago.loadMercadoPago() as any;

      // Create card token using the SDK
      const cardTokenData = {
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardExpiration: cardExpiry,
        cardCVC: cardCvc,
        cardholderName,
        docType,
        docNumber,
      };

      const cardTokenResponse = await mp.createCardToken(cardTokenData);

      if (!cardTokenResponse.id) {
        throw new Error('No se pudo crear el token de tarjeta');
      }

      // Call backend to create preapproval
      const response = await fetch(
        `${BACKEND_URL}/api/subscriptions/create-preapproval`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cardTokenId: cardTokenResponse.id,
            planType,
            billingPeriod,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al procesar el pago');
      }

      // Redirect to MercadoPago
      if (data.initPoint) {
        window.location.href = data.initPoint;
      } else {
        throw new Error('No se recibió el enlace de pago');
      }

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      onError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Completar pago</DialogTitle>
          <DialogDescription>
            Plan {planType} —{' '}
            {billingPeriod === BillingPeriod.MONTHLY ? 'Mensual' : 'Anual'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-12">
              Número de tarjeta
            </label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) =>
                setCardNumber(
                  e.target.value
                    .replace(/\D/g, '')
                    .replace(/(\d{4})/g, '$1 ')
                    .trim()
                )
              }
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              required
              className="flex h-4 w-full rounded-md border border-gray-6 bg-gray-1 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-gray-12">
                Vencimiento
              </label>
              <input
                type="text"
                value={cardExpiry}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 4) {
                    setCardExpiry(
                      val.length > 2
                        ? `${val.slice(0, 2)}/${val.slice(2)}`
                        : val
                    );
                  }
                }}
                placeholder="MM/YY"
                maxLength={5}
                required
                className="flex h-4 w-full rounded-md border border-gray-6 bg-gray-1 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-gray-12">CVC</label>
              <input
                type="text"
                value={cardCvc}
                onChange={(e) =>
                  setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="123"
                maxLength={4}
                required
                className="flex h-4 w-full rounded-md border border-gray-6 bg-gray-1 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-12">
              Nombre del titular
            </label>
            <input
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="Como aparece en la tarjeta"
              required
              className="flex h-4 w-full rounded-md border border-gray-6 bg-gray-1 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-gray-12">
                Tipo de documento
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="flex h-4 w-full rounded-md border border-gray-6 bg-gray-1 px-3 py-2 text-sm"
              >
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="NIT">NIT</option>
                <option value="RUT">RUT</option>
              </select>
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-gray-12">
                Número de documento
              </label>
              <input
                type="text"
                value={docNumber}
                onChange={(e) =>
                  setDocNumber(e.target.value.replace(/\D/g, '').slice(0, 20))
                }
                placeholder="123456789"
                required
                className="flex h-4 w-full rounded-md border border-gray-6 bg-gray-1 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-6">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-12">Total a pagar:</span>
              <span className="font-semibold text-lg">
                COP ${new Intl.NumberFormat('es-CO').format(price)}
              </span>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              mode="pill"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              mode="fill"
              isLoading={isProcessing}
              isLoadingText="Procesando..."
              disabled={isProcessing}
            >
              Pagar ahora
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
