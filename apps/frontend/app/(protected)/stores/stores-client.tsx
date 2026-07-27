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

interface CurrentStoreResponse {
  store: CurrentStore | null;
}

export interface StoresClientProps {
  currentStore: CurrentStore | null;
}

export default function StoresClient({ currentStore }: StoresClientProps) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  const [stores, setStores] = useState<ConnectionRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    perPage: 10,
    lastPage: 1,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(false);

  // El endpoint es `/api/stores/connections`, así que `sortBy` se valida
  // con `ListConnectionsDto` (whitelist: 'connectedAt' | 'isActive').
  // `connectedAt` es el valor que ya usa el `DataTable` por default
  // ("Más recientes") y el que el repo soporta.
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"connectedAt" | "isActive">(
    "connectedAt",
  );
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  const fetchStores = useCallback(async () => {
    if (!accessToken) return;
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
    }
  }, [accessToken, currentStore, search, page, perPage, sortBy, order]);

  useEffect(() => {
    if (!accessToken) return;
    const timer = setTimeout(() => {
      fetchStores();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchStores, accessToken]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleSortChange = (
    newSortBy: "connectedAt" | "isActive" | string,
    newOrder: "asc" | "desc",
  ) => {
    // El endpoint `/api/stores/connections` solo acepta
    // `sortBy` ∈ { 'connectedAt', 'isActive' }. Cualquier otro valor
    // se ignora silenciosamente y se cae al default.
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
    fetchStores();
  }, [fetchStores]);

  return (
    <DataTable
      stores={stores}
      pagination={pagination}
      isLoading={isLoading}
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
