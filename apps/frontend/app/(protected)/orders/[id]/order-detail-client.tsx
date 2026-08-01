"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  RefreshCw,
  Send,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/auth/fetch-with-auth";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  OrderDetail,
  OrderDetailItem,
  OrderPushResult,
} from "@/components/Orders/types";
import { tenantPath } from "@/lib/tenant/routes";

interface OrderDetailClientProps {
  orderId: string;
  tenantId: string;
}

function getStoreName(domain: string | null | undefined): string {
  if (!domain) return "—";
  const idx = domain.indexOf(".myshopify.com");
  return idx > -1 ? domain.slice(0, idx) : domain;
}

function formatMoney(value: string, currency: string | null): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  const formatted = num.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

function formatDateLong(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type StatusBadgeTone =
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "neutral"
  | "outline";

function statusTone(status: string): StatusBadgeTone {
  const s = status.toUpperCase();
  if (s === "PAID" || s === "FULFILLED") return "success";
  if (s === "CREATED") return "info";
  if (s === "PENDING") return "warning";
  if (s === "CANCELED" || s === "CANCELLED" || s === "REFUNDED")
    return "danger";
  return "neutral";
}

function statusClass(tone: StatusBadgeTone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    case "info":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30";
    case "warning":
      return "bg-amber-500/10 text-amber-700 border-amber-500/30";
    case "danger":
      return "bg-red-500/10 text-red-600 border-red-500/30";
    default:
      return "bg-gray-500/10 text-gray-600 border-gray-500/30";
  }
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClass(tone)}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function SummaryCard({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {icon && <div className="mb-4 flex items-center gap-2">{icon}</div>}
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
      {children}
    </h3>
  );
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function ItemRow({
  item,
  currency,
}: {
  item: OrderDetailItem;
  currency: string | null;
}) {
  const lineTotal = (Number(item.unitPrice) * item.quantity).toFixed(2);
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.title ?? item.sku ?? "Item"}
                className="size-12 rounded-lg object-cover"
              />
            ) : (
              <ShoppingBag className="size-5" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">
              {item.title ?? `Línea ${item.vendorLineItemId}`}
            </span>
            {item.sku && (
              <span className="text-xs text-gray-500">SKU: {item.sku}</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
        {formatMoney(item.unitPrice, currency)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 text-center whitespace-nowrap">
        {item.quantity}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
        {formatMoney(lineTotal, currency)}
      </td>
    </tr>
  );
}

export default function OrderDetailClient({
  orderId,
  tenantId,
}: OrderDetailClientProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shippingFee, setShippingFee] = useState("");
  const [isPushing, setIsPushing] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const detail = await apiFetch<OrderDetail>(
        `/api/orders/${orderId}`,
        { method: "GET" },
        accessToken,
      );
      setOrder(detail);
      setNotFound(false);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        setNotFound(true);
      } else {
        console.error("Error fetching order detail", err);
        toast.error("No se pudo cargar el detalle del pedido.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    void fetchOrder();
  }, [sessionStatus, fetchOrder]);

  const handlePush = useCallback(async () => {
    if (!accessToken || !order) return;
    setIsPushing(true);
    try {
      const fee =
        shippingFee.trim().length > 0 ? Number(shippingFee) : null;
      if (fee !== null && (!Number.isFinite(fee) || fee < 0)) {
        toast.error("El envío manual debe ser un número mayor o igual a 0.");
        setIsPushing(false);
        return;
      }
      const result = await apiFetch<OrderPushResult>(
        `/api/orders/${order.id}/push`,
        {
          method: "POST",
          body: JSON.stringify({ shippingFee: fee }),
        },
        accessToken,
      );
      if (result.status === "ALREADY_PUSHED") {
        toast.info("Este pedido ya fue empujado a la tienda origen.");
      } else {
        toast.success("Pedido empujado a la tienda origen.");
      }
      void fetchOrder();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo empujar el pedido.";
      toast.error(message);
    } finally {
      setIsPushing(false);
    }
  }, [accessToken, order, shippingFee, fetchOrder]);

  const itemCount = useMemo(
    () => (order?.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    [order?.items],
  );

  const isPushed = Boolean(order?.sourceShopifyOrderId);

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      );
    }

    if (notFound || !order) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center">
          <div className="inline-block p-4 bg-[#137fec]/10 rounded-full mb-4">
            <ShoppingBag className="size-8 text-[#137fec]" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Pedido no encontrado
          </h3>
          <p className="mt-1 text-sm text-gray-500 max-w-md">
            No se pudo encontrar el pedido solicitado. Es posible que haya
            sido eliminado o no tengas permisos para verlo.
          </p>
          <Link
            href={tenantPath(tenantId, "/orders")}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-[#137fec] text-white text-sm font-bold shadow-sm hover:bg-[#137fec]/90 transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Volver a pedidos</span>
          </Link>
        </div>
      );
    }

    const payload = (order.payload ?? {}) as Record<string, unknown>;
    const financialStatus = typeof payload.financial_status === "string"
      ? String(payload.financial_status)
      : null;
    const fulfillmentStatus = typeof payload.fulfillment_status === "string"
      ? String(payload.fulfillment_status)
      : null;

    const subtotal = order.subtotal;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <SummaryCard
            icon={
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#137fec]/10 text-[#137fec]">
                <RefreshCw className="size-4" />
              </span>
            }
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">
                  Estado:
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/10 px-3 py-1 text-xs font-medium text-gray-700">
                  <span className="size-1.5 rounded-full bg-gray-500" />
                  {isPushed ? "Empujado" : "No empujado"}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                El pedido contiene productos sincronizados de{" "}
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-md bg-[#137fec]/10 text-[#137fec] text-xs font-semibold">
                  {itemCount}
                </span>{" "}
                tienda{singularPlural(itemCount)} origen.
              </p>
            </div>
          </SummaryCard>

          {/* Order details */}
          <SummaryCard>
            <div className="flex items-start gap-3 mb-4">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <ShoppingBag className="size-4" />
              </span>
              <h2 className="text-lg font-bold text-gray-900">
                Detalles del pedido: #{order.vendorShopifyOrderId}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {financialStatus && (
                <StatusBadge status={financialStatus} />
              )}
              {fulfillmentStatus && (
                <StatusBadge status={fulfillmentStatus} />
              )}
              {!financialStatus && !fulfillmentStatus && (
                <StatusBadge status={order.status} />
              )}
            </div>

            <dl className="space-y-2">
              <FieldRow
                label="Order Id"
                value={
                  <span className="font-mono text-[#137fec]">
                    {order.id}
                  </span>
                }
              />
              <FieldRow
                label="Creado"
                value={formatDateLong(order.createdAt)}
              />
            </dl>
          </SummaryCard>

          {/* Vendor store + push action */}
          <SummaryCard>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-12 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                  <Truck className="size-5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-base font-bold text-gray-900">
                    {getStoreName(order.sourceStoreDomain)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {order.sourceStoreDomain ?? "Tienda origen"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <DollarSign className="size-4" />
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(e.target.value)}
                    placeholder="Ingresa un envío"
                    disabled={isPushed}
                    className="h-10 w-56 rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/40 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePush}
                  disabled={isPushed || isPushing}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-[#0e1626] hover:bg-[#0e1626]/90 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none"
                >
                  {isPushing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  <span>{isPushed ? "Ya empujado" : "Empujar pedido"}</span>
                </button>
              </div>
            </div>
          </SummaryCard>

          {/* Items table */}
          <SummaryCard>
            <SectionLabel>Líneas del pedido</SectionLabel>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Imagen</th>
                    <th className="px-4 py-3 font-semibold">Título</th>
                    <th className="px-4 py-3 font-semibold">Precio</th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Cantidad
                    </th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-gray-500"
                      >
                        No hay líneas registradas para este pedido.
                      </td>
                    </tr>
                  ) : (
                    order.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        currency={order.currency}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  Subtotal
                </span>
                <span className="text-base font-bold text-gray-900">
                  {formatMoney(subtotal, order.currency)}
                </span>
              </div>
            </div>
          </SummaryCard>
        </div>

        <div className="space-y-6">
          {/* Notes */}
          <SummaryCard>
            <SectionLabel>Notas</SectionLabel>
            <p className="text-sm text-gray-600">
              No hay notas ni feedback proporcionado por el cliente.
            </p>
          </SummaryCard>

          {/* Additional Notes / SYNCIO INFO */}
          <SummaryCard>
            <SectionLabel>Notas adicionales</SectionLabel>
            <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
              Información del pedido SYNCIO
            </h4>
            <dl className="space-y-3">
              <FieldRow
                label="Tienda destino"
                value={
                  order.vendorStoreDomain ? (
                    <>
                      {getStoreName(order.vendorStoreDomain)}{" "}
                      <span className="text-gray-500">
                        ({order.vendorStoreDomain})
                      </span>
                    </>
                  ) : (
                    "—"
                  )
                }
              />
              <FieldRow
                label="Número de orden destino"
                value={`#${order.vendorShopifyOrderId}`}
              />
              <FieldRow
                label="Configuración de impuestos"
                value={
                  typeof payload.taxes_included === "boolean"
                    ? payload.taxes_included
                      ? "Impuestos incluidos"
                      : "Impuestos excluidos"
                    : "Impuestos excluidos en los precios"
                }
              />
            </dl>
          </SummaryCard>

          {/* Customer */}
          <SummaryCard>
            <SectionLabel>Cliente</SectionLabel>
            <p className="text-sm text-gray-900 font-medium">
              {order.customer.name ?? "—"}
            </p>

            <div className="mt-4">
              <h5 className="text-sm font-bold text-gray-900 mb-2">
                Información de contacto
              </h5>
              <p className="text-sm text-gray-600">
                {order.customer.contactEmail ?? order.customer.email ?? "—"}
              </p>
            </div>

            {order.customer.shippingAddress && (
              <div className="mt-4">
                <h5 className="text-sm font-bold text-gray-900 mb-2">
                  Dirección de envío
                </h5>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {order.customer.shippingAddress}
                </p>
              </div>
            )}

            {order.customer.billingAddress && (
              <div className="mt-4">
                <h5 className="text-sm font-bold text-gray-900 mb-2">
                  Dirección de facturación
                </h5>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {order.customer.billingAddress}
                </p>
              </div>
            )}
          </SummaryCard>

          {order.payout && <PayoutSummary payout={order.payout} />}
        </div>
      </div>
    );
  };

  return (
    <div className="p-12 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(tenantPath(tenantId, "/orders"))}
            className="inline-flex items-center justify-center size-9 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
            aria-label="Volver a pedidos"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
              Resumen del pedido
            </h1>
            {order && (
              <p className="text-sm text-gray-500">
                Pedido #{order.vendorShopifyOrderId}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            aria-label="Pedido anterior"
            className="inline-flex items-center justify-center gap-1 h-9 px-3 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="size-4" />
            <span>Pedido anterior</span>
          </button>
          <button
            type="button"
            disabled
            aria-label="Pedido siguiente"
            className="inline-flex items-center justify-center gap-1 h-9 px-3 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Pedido siguiente</span>
            <ChevronRight className="size-4" />
          </button>
          <Link
            href={tenantPath(tenantId, "/orders")}
            className="inline-flex items-center justify-center size-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </Link>
        </div>
      </header>

      {renderBody()}
    </div>
  );
}

function singularPlural(n: number): string {
  return n === 1 ? "" : "s";
}

function PayoutSummary({
  payout,
}: {
  payout: NonNullable<OrderDetail["payout"]>;
}) {
  const isPaid = payout.status.toUpperCase() === "PAID";
  return (
    <SummaryCard>
      <SectionLabel>Liquidación</SectionLabel>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Monto bruto</span>
          <span className="text-gray-900 font-medium">
            {formatMoney(payout.grossAmount, payout.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Comisión</span>
          <span className="text-gray-900 font-medium">
            {formatMoney(payout.commissionAmount, payout.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm border-t pt-2 border-gray-200">
          <span className="text-gray-900 font-semibold">Neto</span>
          <span className="text-gray-900 font-bold">
            {formatMoney(payout.netAmount, payout.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Estado</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              isPaid
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-700 border-amber-500/30"
            }`}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {isPaid ? "Pagado" : "Pendiente"}
          </span>
        </div>
      </div>
    </SummaryCard>
  );
}
