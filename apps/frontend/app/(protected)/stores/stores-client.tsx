"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/auth/fetch-with-auth";
import { BACKEND_URL } from "@/lib/env";
import DataTable from "@/components/Stores/DataTable";
import type {
  ConnectionRow,
  PaginationMeta,
  StoreConnectionListResponse,
} from "@/components/Stores/types";
import type { CurrentStore } from "@/lib/store/current";

export type { ConnectionRow } from "@/components/Stores/types";

export interface StoresClientProps {
  currentStore: CurrentStore | null;
  tenantId: string;
}

export default function StoresClient({
  currentStore,
  tenantId,
}: StoresClientProps) {
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;

  const [stores, setStores] = useState<ConnectionRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    perPage: 10,
    lastPage: 1,
    totalPages: 1,
  });
  // Arranca en `true` para mostrar skeleton desde el primer paint.
  const [isLoading, setIsLoading] = useState(true);
  // Evita el flash del emptyState antes de la primera respuesta.
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

  // El endpoint es `/api/stores/connections`, así que `sortBy` se valida
  // con `ListConnectionsDto` (whitelist: 'connectedAt' | 'isActive').
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"connectedAt" | "isActive">(
    "connectedAt",
  );
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  const fetchStores = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      setHasFetchedOnce(true);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        page: String(page),
        perPage: String(perPage),
        sortBy,
        order,
      });
      const url = `${BACKEND_URL}/api/stores/connections?${params.toString()}`;
      const res = await apiFetch<StoreConnectionListResponse>(
        url,
        { method: "GET" },
        accessToken,
      );
      const connectedStores = res.data ?? [];
      const matchesOwnStore = currentStore
        ? currentStore.shopifyShopId
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        : false;
      const ownStore: ConnectionRow | null =
        currentStore && matchesOwnStore
          ? {
              id: `own-${currentStore.id}`,
              storeId: currentStore.id,
              shopifyShopId: currentStore.shopifyShopId,
              role: currentStore.role,
              isActive: currentStore.isActive,
              status: "ACTIVE",
              connectedAt: null,
              isInitiator: false,
              isOwn: true,
            }
          : null;
      setStores(ownStore ? [ownStore, ...connectedStores] : connectedStores);
      setPagination(
        res.pagination
          ? {
              ...res.pagination,
              total: res.pagination.total + (ownStore ? 1 : 0),
            }
          : {
              total: 0,
              page: 1,
              perPage,
              lastPage: 1,
              totalPages: 1,
            },
      );
    } catch (err) {
      console.error("Error fetching stores:", err);
      setStores([]);
    } finally {
      setIsLoading(false);
      setHasFetchedOnce(true);
    }
  }, [accessToken, currentStore, search, page, perPage, sortBy, order]);

  useEffect(() => {
    // Espera a que NextAuth termine de hidratarse.
    if (sessionStatus === "loading") return;

    // Debounce de búsqueda/filtros; además evita setState síncrono
    // dentro del cuerpo del effect (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      void fetchStores();
    }, 300);

    return () => clearTimeout(timer);
  }, [sessionStatus, fetchStores]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleSortChange = (
    newSortBy: "connectedAt" | "isActive" | string,
    newOrder: "asc" | "desc",
  ) => {
    const allowed: Array<"connectedAt" | "isActive"> = [
      "connectedAt",
      "isActive",
    ];
    const safeSortBy = allowed.includes(
      newSortBy as "connectedAt" | "isActive",
    )
      ? (newSortBy as "connectedAt" | "isActive")
      : "connectedAt";
    setSortBy(safeSortBy);
    setOrder(newOrder);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleRefetch = useCallback(() => {
    setPage(1);
    void fetchStores();
  }, [fetchStores]);

  return (
    <DataTable
      stores={stores}
      tenantId={tenantId}
      pagination={pagination}
      isLoading={isLoading}
      hasFetchedOnce={hasFetchedOnce}
      search={search}
      sortBy={sortBy}
      order={order}
      currentStore={currentStore}
      onSearchChange={handleSearchChange}
      onSortChange={handleSortChange}
      onPageChange={handlePageChange}
      onRefetch={handleRefetch}
    />
  );
}
