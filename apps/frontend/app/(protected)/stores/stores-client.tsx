"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/auth/fetch-with-auth";
import DataTable from "@/components/Stores/DataTable";
import type { PaginationMeta } from "@/components/Stores/types";

export interface Store {
  id: string;
  shopifyShopId: string;
  role: "SOURCE" | "VENDOR";
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

interface StoresResponse {
  data: Store[];
  pagination: PaginationMeta;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function StoresClient() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  const [stores, setStores] = useState<Store[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    perPage: 10,
    lastPage: 1,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
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
      const url = `${BACKEND_URL}/api/stores?${params.toString()}`;
      const res = await apiFetch<StoresResponse>(
        url,
        { method: "GET" },
        accessToken
      );
      setStores(res.data ?? []);
      setPagination(
        res.pagination ?? {
          total: 0,
          page: 1,
          perPage,
          lastPage: 1,
          totalPages: 1,
        }
      );
    } catch (err) {
      console.error("Error fetching stores:", err);
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, search, page, perPage, sortBy, order]);

  // Debounce 300ms para search; fetch inmediato para sort/order/page
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

  const handleSortChange = (newSortBy: string, newOrder: "asc" | "desc") => {
    setSortBy(newSortBy);
    setOrder(newOrder);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <DataTable
      stores={stores}
      pagination={pagination}
      isLoading={isLoading}
      search={search}
      sortBy={sortBy}
      order={order}
      onSearchChange={handleSearchChange}
      onSortChange={handleSortChange}
      onPageChange={handlePageChange}
    />
  );
}