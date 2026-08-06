"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/auth/fetch-with-auth";
import { BACKEND_URL } from "@/lib/env";
import { createSyncSocket } from "@/lib/realtime/sync-socket";
import DataTable from "@/components/Orders/DataTable";
import type {
  OrderRow,
  PaginationMeta,
  OrderListResponse,
} from "@/components/Orders/types";
import { tenantPath } from "@/lib/tenant/routes";

export type { OrderRow } from "@/components/Orders/types";

export interface OrdersClientProps {
  tenantId: string;
}

type SortKey = "createdAt" | "updatedAt" | "status";

const ALLOWED_SORT_KEYS: SortKey[] = ["createdAt", "updatedAt", "status"];

export default function OrdersClient({ tenantId }: OrdersClientProps) {
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    perPage: 20,
    lastPage: 1,
    totalPages: 1,
  });
  // Arranca en `true` para mostrar skeleton desde el primer paint.
  const [isLoading, setIsLoading] = useState(true);
  // Evita el flash del emptyState antes de la primera respuesta.
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);

  const buildDetailHref = useCallback(
    (orderId: string) => tenantPath(tenantId, `/orders/${orderId}`),
    [tenantId],
  );

  const fetchOrders = useCallback(async () => {
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
      const res = await apiFetch<OrderListResponse>(
        `${BACKEND_URL}/api/tenant/${tenantId}/orders?${params.toString()}`,
        { method: "GET" },
        accessToken,
      );
      const data = res.data ?? [];
      setOrders(data);
      setPagination(
        res.pagination ?? {
          total: 0,
          page: 1,
          perPage,
          lastPage: 1,
          totalPages: 1,
        },
      );
    } catch (err) {
      console.error("Error fetching orders:", err);
      setOrders([]);
    } finally {
      setIsLoading(false);
      setHasFetchedOnce(true);
    }
  }, [accessToken, order, page, perPage, search, sortBy, tenantId]);

  useEffect(() => {
    if (sessionStatus === "loading") return;

    const timer = setTimeout(() => {
      void fetchOrders();
    }, 300);

    return () => clearTimeout(timer);
  }, [sessionStatus, fetchOrders]);

  useEffect(() => {
    if (!accessToken) return;

    const socket = createSyncSocket(accessToken);
    const refreshOrders = (notification?: { type?: string }) => {
      if (!notification?.type || notification.type === "ORDER_CREATED") {
        void fetchOrders();
      }
    };

    socket.on("connect", () => refreshOrders());
    socket.on("notification.created", refreshOrders);
    return () => {
      socket.disconnect();
    };
  }, [accessToken, fetchOrders]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleSortChange = (newSortBy: string, newOrder: "asc" | "desc") => {
    const safeSortBy: SortKey = ALLOWED_SORT_KEYS.includes(
      newSortBy as SortKey,
    )
      ? (newSortBy as SortKey)
      : "createdAt";
    setSortBy(safeSortBy);
    setOrder(newOrder);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <DataTable
      orders={orders}
      pagination={pagination}
      isLoading={isLoading}
      hasFetchedOnce={hasFetchedOnce}
      search={search}
      sortBy={sortBy}
      order={order}
      buildDetailHref={buildDetailHref}
      onSearchChange={handleSearchChange}
      onSortChange={handleSortChange}
      onPageChange={handlePageChange}
    />
  );
}
