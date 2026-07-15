'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/auth/fetch-with-auth';
import { BACKEND_URL } from '@/lib/env';
import DataTable from '@/components/Stores/DataTable';
import type {
  ConnectionRow,
  PaginationMeta,
  StoreConnectionListResponse,
} from '@/components/Stores/types';
import type { CurrentStore } from '@/lib/store/current';

export type { ConnectionRow } from '@/components/Stores/types';

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

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('connectedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
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
      const res = await apiFetch<StoreConnectionListResponse>(
        url,
        { method: 'GET' },
        accessToken,
      );
      setStores(res.data ?? []);
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
      console.error('Error fetching stores:', err);
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, search, page, perPage, sortBy, order]);

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
    newSortBy: string,
    newOrder: 'asc' | 'desc',
  ) => {
    setSortBy(newSortBy);
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
