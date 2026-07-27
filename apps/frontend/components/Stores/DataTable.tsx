'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
} from '@tanstack/react-table';
import { Search, PlusCircle, ChevronDown, Store } from 'lucide-react';

import { Skeleton } from '@/components/ui/Skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu';

import ConnectStoreDialog from './ConnectStoreDialog';
import { DisconnectConfirmDialog } from './DisconnectConfirmDialog';
import { ServerPaginationControls } from './ServerPaginationControls';
import type { ConnectionRow, PaginationMeta } from './types';
import type { CurrentStore } from '@/lib/store/current';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/auth/fetch-with-auth';
import { BACKEND_URL } from '@/lib/env';
import { toast } from 'sonner';
import { getStoreName, getStoresColumns } from './Columns';

interface DataTableProps {
  stores: ConnectionRow[];
  tenantId: string;
  pagination: PaginationMeta;
  isLoading: boolean;
  /**
   * `true` cuando ya se completó la primera petición al backend.
   * Mientras sea `false`, se muestra el skeleton aunque `isLoading`
   * sea `false` y `stores` esté vacío, evitando el "flash" del
   * emptyState en el primer render del cliente tras recargar.
   */
  hasFetchedOnce?: boolean;
  search: string;
  sortBy: string;
  order: 'asc' | 'desc';
  currentStore: CurrentStore | null;
  onSearchChange: (v: string) => void;
  onSortChange: (sortBy: string, order: 'asc' | 'desc') => void;
  onPageChange: (page: number) => void;
  onRefetch: () => void;
}

type SortKey =
  | 'connectedAt:desc'
  | 'connectedAt:asc'
  | 'shopifyShopId:asc'
  | 'shopifyShopId:desc';

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Más recientes', value: 'connectedAt:desc' },
  { label: 'Más antiguos', value: 'connectedAt:asc' },
  { label: 'A → Z', value: 'shopifyShopId:asc' },
  { label: 'Z → A', value: 'shopifyShopId:desc' },
];

export default function DataTable({
  stores,
  tenantId,
  pagination,
  isLoading,
  hasFetchedOnce = false,
  search,
  sortBy,
  order,
  currentStore,
  onSearchChange,
  onSortChange,
  onPageChange,
  onRefetch,
}: DataTableProps) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  const [connectOpen, setConnectOpen] = useState(false);
  const [pendingDisconnect, setPendingDisconnect] =
    useState<ConnectionRow | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const requestDisconnect = (row: ConnectionRow) => {
    setPendingDisconnect(row);
  };

  const closeDisconnect = () => {
    if (isDisconnecting) return;
    setPendingDisconnect(null);
  };

  const confirmDisconnect = async () => {
    if (!pendingDisconnect || !accessToken) return;
    setIsDisconnecting(true);
    try {
      await apiFetch(
        `${BACKEND_URL}/api/stores/connections/${pendingDisconnect.id}`,
        { method: 'DELETE' },
        accessToken,
      );
      toast.success('Tienda desconectada');
      setPendingDisconnect(null);
      onRefetch();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo desconectar la tienda';
      toast.error(message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const columns = useMemo<ColumnDef<ConnectionRow>[]>(
    () =>
      getStoresColumns({
        tenantId,
        onDisconnect: requestDisconnect,
        currentStore,
      }),
    [currentStore],
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [debouncedGlobalFilter, setDebouncedGlobalFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedGlobalFilter(globalFilter), 300);
    return () => clearTimeout(t);
  }, [globalFilter]);

  const table = useReactTable({
    data: stores,
    columns,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      globalFilter: debouncedGlobalFilter,
    },
  });

  const currentSort: SortKey = `${sortBy}:${order}` as SortKey;
  const currentSortLabel = useMemo(
    () =>
      SORT_OPTIONS.find((o) => o.value === currentSort)?.label ??
      'Más recientes',
    [currentSort],
  );

  const emptyState = (
    <div className="text-center py-16 px-4">
      <div className="inline-block p-4 bg-[#137fec]/10 rounded-full mb-4">
        <Store className="size-8 text-[#137fec]" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        No tienes tiendas conectadas todavía
      </h3>
      <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
        Podés invitar al {currentStore?.role === 'VENDOR' ? 'Source' : 'Vendor'} por
        correo o pegar la clave que te compartieron para crear la conexión.
      </p>
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setConnectOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-[#137fec] text-white text-sm font-bold shadow-sm hover:bg-[#137fec]/90 transition-colors mx-auto cursor-pointer border-none"
        >
          <PlusCircle className="size-4" />
          <span>Añadir Primera Tienda</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-12 space-y-8">
      {/* Page Heading */}
      <header className="flex flex-col sm:flex-row flex-wrap justify-between items-start gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Gestión de Tiendas
          </h1>
          <p className="text-base font-normal text-gray-500">
            Administra y monitorea tus tiendas Shopify conectadas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConnectOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-[#137fec] hover:bg-[#137fec]/90 text-white text-sm font-bold shadow-sm transition-colors cursor-pointer border-none"
          aria-label="Añadir Nueva Tienda"
        >
          <PlusCircle className="size-4" />
          <span className="truncate">Añadir Nueva Tienda</span>
        </button>
      </header>

      {/* Main Container Card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        {/* ToolBar & SearchBar */}
        <div className="flex flex-col md:flex-row justify-between gap-4 p-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <label className="flex flex-col w-full">
              <div className="flex items-stretch rounded-lg h-10">
                <div className="text-gray-400 flex bg-gray-100 items-center justify-center pl-3 rounded-l-lg">
                  <Search className="size-4" />
                </div>
                <input
                  className="default flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#137fec]/50 border-none bg-gray-100 h-full placeholder:text-gray-400 px-3 text-sm"
                  placeholder="Filtrar tiendas por nombre..."
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer border-none"
                >
                  <span>Orden: {currentSortLabel}</span>
                  <ChevronDown className="size-4 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onSelect={() => {
                      const [sb, od] = opt.value.split(':') as [
                        string,
                        'asc' | 'desc',
                      ];
                      onSortChange(sb, od);
                    }}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* DataTable */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className="px-6 py-3 font-semibold tracking-wide text-xs leading-5"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading || !hasFetchedOnce ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr
                    key={`skel-${i}`}
                    className="bg-white border-b border-gray-200"
                  >
                    <td colSpan={columns.length} className="px-6 py-4">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-white border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="p-0">
                    {emptyState}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <ServerPaginationControls
          pagination={pagination}
          currentPage={pagination.page}
          onPageChange={onPageChange}
        />
      </div>

      <ConnectStoreDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        currentStore={currentStore}
        onConnected={onRefetch}
      />

      <DisconnectConfirmDialog
        open={Boolean(pendingDisconnect)}
        onOpenChange={(open: boolean) => {
          if (!open) closeDisconnect();
        }}
        storeLabel={
          pendingDisconnect
            ? getStoreName(pendingDisconnect.shopifyShopId)
            : ''
        }
        isPending={isDisconnecting}
        onConfirm={confirmDisconnect}
      />
    </div>
  );
}