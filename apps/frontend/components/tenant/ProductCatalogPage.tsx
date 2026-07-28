"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { fetchWithAuth, useAuthFetch } from "@/lib/auth/fetch-with-auth";
import { createSyncSocket } from "@/lib/realtime/sync-socket";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { ServerPaginationControls } from "@/components/Stores/ServerPaginationControls";
import type { PaginationMeta } from "@/components/Stores/types";

type Source = {
  storeId: string;
  shopifyShopId: string;
  kind: string;
  productCount?: number;
};
type Product = {
  id: string;
  title: string;
  isSynced: boolean;
  updatedAt?: string;
  images?: unknown;
  variants?: Array<{
    sku?: string;
    price?: string | number;
    inventoryQuantity?: number;
  }>;
};
type ProductResponse = {
  data: Product[];
  total: number;
  pagination?: { totalPages: number };
};
type Progress = {
  batchId?: string;
  sourceStoreId?: string;
  storeId?: string;
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  status: string;
};
type InitialProgressResponse = {
  id: string;
  storeId: string;
  status: string;
  totalProducts: number;
  processedProducts: number;
  succeededProducts: number;
  failedProducts: number;
};

const SORT_OPTIONS = [
  { label: "Nombre A-Z", value: "title:asc" },
  { label: "Nombre Z-A", value: "title:desc" },
  { label: "Más recientes", value: "createdAt:desc" },
  { label: "Más antiguos", value: "createdAt:asc" },
] as const;

function getProductImage(product: Product) {
  if (!Array.isArray(product.images)) return "";
  const image = product.images[0];
  if (typeof image === "string") return image;
  if (image && typeof image === "object" && "src" in image)
    return String((image as { src?: unknown }).src ?? "");
  return "";
}

function numericProgress(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function mergeProgress(
  next: Partial<Progress> | null | undefined,
  previous?: Progress | null,
): Progress | null {
  if (!next) return previous ?? null;
  return {
    ...previous,
    ...next,
    processed: numericProgress(next.processed, previous?.processed ?? 0),
    total: numericProgress(
      next.total,
      previous?.total && previous.total > 0 ? previous.total : 0,
    ),
    succeeded: numericProgress(next.succeeded, previous?.succeeded ?? 0),
    failed: numericProgress(next.failed, previous?.failed ?? 0),
    skipped: numericProgress(next.skipped, previous?.skipped ?? 0),
    status: String(next.status ?? previous?.status ?? "PENDING"),
  };
}

export default function ProductCatalogPage({ tenantId }: { tenantId: string }) {
  const { data: session } = useSession();
  const [sourceId, setSourceId] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);

  const { data: sourceResponse } = useAuthFetch<{ data: Source[] }>(
    `/api/tenant/${tenantId}/product-sources`,
  );
  const sources = sourceResponse?.data ?? [];
  useEffect(() => {
    if (!sourceId && sources.length) setSourceId(sources[0].storeId);
  }, [sourceId, sources]);

  const productsEndpoint = sourceId
    ? `/api/tenant/${tenantId}/products?sourceStoreId=${sourceId}&page=${page}&perPage=20&sortBy=${sortBy}&order=${order}`
    : null;
  const { data, mutate, isLoading } =
    useAuthFetch<ProductResponse>(productsEndpoint);
  const { data: activeBatch, mutate: mutateActiveBatch } =
    useAuthFetch<Progress | null>(
    sourceId
      ? `/api/tenant/${tenantId}/sync-batches/active?sourceStoreId=${sourceId}`
      : null,
    { refreshInterval: 1000, revalidateOnFocus: true },
  );
  const { data: activeInitialSync, mutate: mutateActiveInitialSync } =
    useAuthFetch<InitialProgressResponse | null>(
      sourceId
        ? `/api/tenant/${tenantId}/initial-sync/active?storeId=${sourceId}`
        : null,
      { refreshInterval: 1000, revalidateOnFocus: true },
    );
  const products = data?.data ?? [];
  const totalPages =
    data?.pagination?.totalPages ??
    Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  const activeSource = useMemo(
    () => sources.find((source) => source.storeId === sourceId),
    [sourceId, sources],
  );
  const allSelected =
    products.length > 0 &&
    products.every((product) => selected.includes(product.id));
  const isRunning =
    progress?.status === "RUNNING" ||
    progress?.status === "PENDING" ||
    activeBatch?.status === "RUNNING" ||
    activeBatch?.status === "PENDING";
  const progressHasTotal = Boolean(progress && progress.total > 0);
  const pagination: PaginationMeta = {
    page,
    perPage: 20,
    total: data?.total ?? 0,
    lastPage: totalPages,
    totalPages,
  };
  const currentSort = `${sortBy}:${order}`;
  const currentSortLabel =
    SORT_OPTIONS.find((option) => option.value === currentSort)?.label ??
    "Más recientes";

  useEffect(() => {
    if (activeBatch && (!activeBatch.sourceStoreId || activeBatch.sourceStoreId === sourceId))
      setProgress((current) => mergeProgress(activeBatch, current));
  }, [activeBatch]);

  useEffect(() => {
    if (!activeInitialSync) return;
    setProgress((current) =>
      mergeProgress(
        {
          storeId: activeInitialSync.storeId,
          status: activeInitialSync.status,
          total: activeInitialSync.totalProducts,
          processed: activeInitialSync.processedProducts,
          succeeded: activeInitialSync.succeededProducts,
          failed: activeInitialSync.failedProducts,
          skipped: 0,
        },
        current,
      ),
    );
  }, [activeInitialSync]);

  useEffect(() => {
    const batchId = progress?.batchId;
    if (
      !batchId ||
      !session?.accessToken ||
      !["PENDING", "RUNNING"].includes(progress.status)
    )
      return;

    let cancelled = false;
    const reconcileBatch = async () => {
      try {
        const batch = await fetchWithAuth<Progress>(
          `/api/tenant/${tenantId}/sync-batches/${batchId}`,
          {},
          session.accessToken,
        );
        if (cancelled) return;
        setProgress((current) => mergeProgress(batch, current));
        if (["COMPLETED", "PARTIAL", "FAILED"].includes(batch.status)) {
          void mutate();
        }
      } catch {
        // Socket.IO remains the primary realtime channel; a transient HTTP
        // failure is retried on the next interval.
      }
    };

    void reconcileBatch();
    const interval = window.setInterval(() => void reconcileBatch(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mutate, progress?.batchId, progress?.status, session?.accessToken, tenantId]);

  useEffect(() => {
    if (!session?.accessToken) return;
    const socket = createSyncSocket(session.accessToken);
    socket.on("connect", () => {
      void mutateActiveBatch();
      void mutateActiveInitialSync();
    });
    socket.on("sync.batch.progress", (event: Progress) => {
      if (event.sourceStoreId && event.sourceStoreId !== sourceId) return;
      setProgress((current) => mergeProgress(event, current));
      if (["COMPLETED", "PARTIAL", "FAILED"].includes(event.status)) {
        setNotice(
          `Sincronización finalizada: ${event.processed}/${event.total} procesados.`,
        );
        void mutate();
      }
    });
    socket.on("initial-sync.progress", (event: Progress) => {
      if (event.storeId === sourceId) {
        setProgress((current) => mergeProgress(event, current));
        if (["COMPLETED", "PARTIAL", "FAILED"].includes(event.status)) {
          setNotice(
            `Sincronización inicial finalizada: ${event.processed}/${event.total} procesados.`,
          );
        }
        void mutate();
      }
    });
    socket.on(
      "inventory.updated",
      (event: { storeId?: string; availableQuantity?: number }) => {
        if (event.storeId === sourceId) void mutate();
      },
    );
    return () => {
      socket.disconnect();
    };
  }, [
    mutate,
    mutateActiveBatch,
    mutateActiveInitialSync,
    session?.accessToken,
    sourceId,
  ]);

  async function synchronize(input?: string[] | unknown) {
    if (!sourceId) return;
    const productIds = Array.isArray(input) ? input : selected;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetchWithAuth<{ id?: string; total?: number }>(
        `/api/tenant/${tenantId}/sync-batches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceStoreId: sourceId, productIds }),
        },
        session?.accessToken,
      );
      setProgress({
        batchId: response.id,
        sourceStoreId: sourceId,
        processed: 0,
        total:
          response.total && response.total > 0
            ? response.total
            : productIds.length || activeSource?.productCount || 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        status: "PENDING",
      });
      setSelected([]);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible iniciar la sincronización.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-12 space-y-8">
      <header className="flex flex-col sm:flex-row flex-wrap justify-between items-start gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Productos
          </h1>
          <p className="text-base font-normal text-gray-500">
            Sincroniza y administra tu inventario.
          </p>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <select
            className="flex h-10 min-w-64 shrink-0 items-center rounded-lg border-none bg-gray-100 px-4 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#137fec]/50"
            value={sourceId}
            onChange={(event) => {
              setSourceId(event.target.value);
              setPage(1);
              setSelected([]);
              setProgress(null);
            }}
            aria-label="Seleccionar tienda"
          >
            <option value="" disabled>
              Seleccionar tienda
            </option>
            {sources.map((source) => (
              <option key={source.storeId} value={source.storeId}>
                {source.shopifyShopId} ·{" "}
                {source.kind === "CONNECTED" ? "conectada" : "propia"}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="flex h-10 items-center justify-center rounded-lg bg-[#137fec] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#137fec]/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!sourceId || busy}
            onClick={() => void synchronize()}
          >
            {busy ? "Iniciando…" : "Sincronizar"}
          </button>
        </div>
      </header>

      {progress && (
        <div
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${isRunning ? "border-orange-300 bg-orange-500/10 text-orange-700" : progress.status === "FAILED" ? "border-red-300 bg-red-500/10 text-red-700" : "border-emerald-300 bg-emerald-500/10 text-emerald-700"}`}
        >
          <span className={isRunning ? "animate-spin" : ""}>⟳</span>
          {isRunning
            ? progressHasTotal
              ? `Sincronizando ${progress.processed}/${progress.total}`
              : "Preparando sincronización"
            : `Sincronización ${progress.status === "FAILED" ? "con errores" : "completada"}`}
          {progressHasTotal && (
            <span className="text-xs">
              · {progress.succeeded} exitosos · {progress.failed} fallidos ·{" "}
              {progress.skipped} omitidos
            </span>
          )}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-blue-200 bg-blue-500/10 px-4 py-3 text-sm text-blue-700">
          {notice}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between gap-4 p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="font-medium text-gray-700">
              {activeSource?.shopifyShopId ?? "Tienda"}
            </span>
            <span>·</span>
            <span>{data?.total ?? 0} productos</span>
            <button
              type="button"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              onClick={() => void mutate()}
              aria-label="Actualizar productos"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                <span>Orden: {currentSortLabel}</span>
                <ChevronDown className="size-4 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => {
                    const [sort, direction] = option.value.split(":");
                    setSortBy(sort);
                    setOrder(direction as "asc" | "desc");
                    setPage(1);
                  }}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="w-14 px-6 py-3 font-semibold tracking-wide text-xs leading-5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? products.map((product) => product.id)
                          : [],
                      )
                    }
                  />
                </th>
                <th className="px-6 py-3 font-semibold tracking-wide text-xs leading-5">
                  Producto
                </th>
                <th className="px-6 py-3 font-semibold tracking-wide text-xs leading-5">
                  Inventario
                </th>
                <th className="px-6 py-3 font-semibold tracking-wide text-xs leading-5">
                  Estado
                </th>
                <th className="px-6 py-3 font-semibold tracking-wide text-xs leading-5">
                  SKU / variantes
                </th>
                <th className="px-6 py-3 text-right font-semibold tracking-wide text-xs leading-5">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index} className="bg-white border-b border-gray-200">
                    <td colSpan={6} className="px-6 py-4">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : products.length ? (
                products.map((product) => {
                  const image = getProductImage(product);
                  const inventory =
                    product.variants?.reduce(
                      (sum, variant) =>
                        sum + Number(variant.inventoryQuantity ?? 0),
                      0,
                    ) ?? 0;
                  return (
                    <tr
                      key={product.id}
                      className="bg-white border-b border-gray-200 transition-colors hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selected.includes(product.id)}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, product.id]
                                : current.filter((id) => id !== product.id),
                            )
                          }
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center overflow-hidden border border-gray-200 bg-gray-50">
                            {image ? (
                              <img
                                src={image}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-xs text-gray-400">IMG</span>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900 text-sm">
                              {product.title}
                            </span>
                            <span className="block text-xs text-gray-500">
                              {product.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {inventory} para {product.variants?.length ?? 0}{" "}
                        variante{product.variants?.length === 1 ? "" : "s"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            product.isSynced
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-amber-500/10 text-amber-700"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              product.isSynced ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          {product.isSynced ? "Sincronizado" : "No sincronizado"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {product.variants?.[0]?.sku ?? "—"} ·{" "}
                        {product.variants?.length ?? 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                            onClick={() => void synchronize([product.id])}
                          >
                            Sincronizar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16 text-center text-sm text-gray-500"
                  >
                    No hay productos para esta tienda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ServerPaginationControls
          pagination={pagination}
          currentPage={page}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
