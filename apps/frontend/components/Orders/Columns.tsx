"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import Link from "next/link";
import type { OrderRow, OrderPushStatus } from "./types";

interface OrdersColumnsCallbacks {
  /**
   * Resuelve la URL del detalle de la orden. Se inyecta desde
   * el cliente para soportar `/orders/:id` o `/tenant/:tenantId/orders/:id`
   * según el contexto (legacy vs top-level).
   */
  buildDetailHref: (orderId: string) => string;
}

function formatDateLong(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

function PushStatusBadge({ status }: { status: OrderPushStatus }) {
  const isPushed = status === "PUSHED";
  const toneClasses = isPushed
    ? "bg-emerald-500/10 text-emerald-600 [&>span]:bg-emerald-500"
    : "bg-gray-500/10 text-gray-600 [&>span]:bg-gray-500";
  const label = isPushed ? "Empujado" : "No empujado";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses}`}
    >
      <span className="size-1.5 rounded-full" />
      {label}
    </span>
  );
}

function ItemCountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-md bg-[#137fec]/10 text-[#137fec] text-xs font-semibold ring-1 ring-inset ring-[#137fec]/20">
      {count}
    </span>
  );
}

export function getOrdersColumns(
  callbacks: OrdersColumnsCallbacks,
): ColumnDef<OrderRow>[] {
  const { buildDetailHref } = callbacks;

  return [
    {
      id: "order",
      header: () => <span className="block whitespace-nowrap">Order #</span>,
      accessorFn: (row) => row.vendorShopifyOrderId,
      cell: ({ row }) => (
        <Link
          href={buildDetailHref(row.original.id)}
          className="font-medium text-[#137fec] hover:underline text-sm"
        >
          #{row.original.vendorShopifyOrderId}
        </Link>
      ),
    },
    {
      id: "date",
      header: () => (
        <span className="block whitespace-nowrap">Fecha (AEST)</span>
      ),
      accessorFn: (row) => row.createdAt,
      cell: ({ row }) => (
        <span className="text-gray-600 text-sm whitespace-nowrap">
          {formatDateLong(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "customer",
      header: () => <span className="block whitespace-nowrap">Cliente</span>,
      accessorFn: (row) => row.customerName ?? "",
      cell: ({ row }) => (
        <span className="text-gray-900 text-sm font-medium">
          {row.original.customerName ?? "—"}
        </span>
      ),
    },
    {
      id: "pushStatus",
      header: () => (
        <span className="block whitespace-nowrap">Estado de push</span>
      ),
      accessorFn: (row) => row.pushStatus ?? "NOT_PUSHED",
      cell: ({ row }) => (
        <PushStatusBadge status={row.original.pushStatus ?? "NOT_PUSHED"} />
      ),
      enableSorting: false,
    },
    {
      id: "details",
      header: () => <span className="block whitespace-nowrap">Detalles</span>,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 text-sm">
            {row.original.status}
          </span>
          <span className="text-xs text-gray-500">
            #{row.original.vendorShopifyOrderId}
          </span>
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "itemCount",
      header: () => (
        <span className="block whitespace-nowrap text-right">
          Items sincronizados
        </span>
      ),
      accessorFn: (row) => row.itemCount ?? 0,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ItemCountBadge count={row.original.itemCount ?? 0} />
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => (
        <span className="block text-right whitespace-nowrap">Acciones</span>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            href={buildDetailHref(row.original.id)}
            aria-label="Ver detalles"
            title="Ver detalles"
            className="inline-flex items-center justify-center gap-1 rounded-lg h-9 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <Eye className="size-4" />
            <span>Ver detalles</span>
          </Link>
        </div>
      ),
      enableSorting: false,
    },
  ];
}
