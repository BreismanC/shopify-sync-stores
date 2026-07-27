"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Unlink } from "lucide-react";
import type { ConnectionRow, StoreRole } from "./types";
import type { CurrentStore } from "@/lib/store/current";

interface StoresColumnsCallbacks {
  onViewProducts: (row: ConnectionRow) => void;
  onDisconnect: (row: ConnectionRow) => void;
  currentStore: CurrentStore | null;
}

export function getStoreName(shopifyShopId: string): string {
  const idx = shopifyShopId.indexOf(".myshopify.com");
  return idx > -1 ? shopifyShopId.slice(0, idx) : shopifyShopId;
}

function counterpartyRoleLabel(current: StoreRole): string {
  return current === "SOURCE" ? "Vendor" : "Source";
}

function formatConnectedAt(dateStr: string | null | undefined): string {
  if (!dateStr) return "Reciente";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function getStoresColumns(
  callbacks: StoresColumnsCallbacks,
): ColumnDef<ConnectionRow>[] {
  const { onViewProducts, onDisconnect, currentStore } = callbacks;

  return [
    {
      id: "store",
      header: () => "Nombre de Tienda",
      accessorFn: (row) => getStoreName(row.shopifyShopId),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 dark:text-white text-sm">
            {getStoreName(row.original.shopifyShopId)}
          </span>
          <span className="text-xs text-gray-500">
            {row.original.shopifyShopId}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: () => "Estado",
      cell: ({ row }) => {
        const isActive =
          row.original.isActive || row.original.status === "ACTIVE";
        const isError =
          row.original.status === "REJECTED" ||
          row.original.status === "EXPIRED";

        if (isActive) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Conectado
            </span>
          );
        }

        if (isError) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 dark:bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400">
              <span className="size-1.5 rounded-full bg-red-500" />
              Error de Sinc.
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/10 dark:bg-gray-500/20 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
            <span className="size-1.5 rounded-full bg-gray-500" />
            Desconectado
          </span>
        );
      },
      enableSorting: false,
    },
    {
      id: "role",
      header: () => "Tipo",
      cell: ({ row }) => {
        const isOwn =
          currentStore && currentStore.id === row.original.storeId;
        const roleLabel = isOwn
          ? "Propia"
          : counterpartyRoleLabel(
              (currentStore?.role ?? "SOURCE") as StoreRole,
            );

        if (roleLabel === "Source") {
          return (
            <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-300/20">
              Source
            </span>
          );
        }

        if (roleLabel === "Vendor") {
          return (
            <span className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-900/50 px-2.5 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 ring-1 ring-inset ring-purple-700/10 dark:ring-purple-300/20">
              Vendor
            </span>
          );
        }

        return (
          <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-500/10">
            Propia
          </span>
        );
      },
      enableSorting: false,
    },
    {
      id: "connectedAt",
      header: () => "Última Sincronización",
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {formatConnectedAt(row.original.connectedAt)}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          {!row.original.isOwn && (
            <>
              <button
                type="button"
                onClick={() => onViewProducts(row.original)}
                aria-label="Ver productos"
                title="Ver productos"
                className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer border-none bg-transparent"
              >
                <Eye className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onDisconnect(row.original)}
                aria-label="Desconectar"
                title="Desconectar"
                className="p-2 text-gray-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer border-none bg-transparent"
              >
                <Unlink className="size-4" />
              </button>
            </>
          )}
        </div>
      ),
      enableSorting: false,
    },
  ];
}
