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
import { Search, Plus, ChevronDown } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ResponsiveTableCard,
} from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/Empty';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu';

import ConnectStoreDialog from './ConnectStoreDialog';
import { DisconnectConfirmDialog } from './DisconnectConfirmDialog';
import type { ConnectionRow, PaginationMeta } from './types';
import type { CurrentStore } from '@/lib/store/current';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/auth/fetch-with-auth';
import { BACKEND_URL } from '@/lib/env';
import { toast } from 'sonner';
import { getStoreName, getStoresColumns } from './Columns';

interface DataTableProps {
  stores: ConnectionRow[];
  pagination: PaginationMeta;
  isLoading: boolean;
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
  pagination,
  isLoading,
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

  const handleViewProducts = (row: ConnectionRow) => {
    void row;
    toast.info('Próximamente: vista de productos');
  };

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
        onViewProducts: handleViewProducts,
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
    <Empty>
      <EmptyMedia>
        <Plus className="size-5 text-gray-9" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>No hay tiendas conectadas</EmptyTitle>
        <EmptyDescription>
          Podés invitar al {currentStore?.role === 'VENDOR' ? 'Source' : 'Vendor'} por
          correo o pegar la clave que te compartieron para crear la
          conexión.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-12">Tiendas</h2>
          <p className="text-gray-11 mt-1">
            Conectá y administrá las tiendas Shopify vinculadas a tu tienda.
          </p>
          <a
            href="#"
            className="text-accent-9 hover:underline text-sm mt-1 inline-block"
          >
            Aprendé sobre conectar tiendas
          </a>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-gray-9" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar tienda"
              className="pl-7 w-[240px]"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button mode="pill" size="sm">
                <span>{currentSortLabel}</span>
                <ChevronDown className="size-3" />
              </Button>
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

          <Button
            onClick={() => setConnectOpen(true)}
            className="bg-accent-9 hover:bg-accent-10 text-accent-contrast"
            aria-label="Conectar tienda"
          >
            <Plus className="size-3.5" />
            <span>Conectar tienda</span>
          </Button>
        </div>
      </div>

      <div className="border border-gray-a6 rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell colSpan={columns.length}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>{emptyState}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ResponsiveTableCard
        headers={
          table
            .getHeaderGroups()[0]
            ?.headers.filter((header) => !header.isPlaceholder)
            .map((header) => ({
              id: header.id,
              header: flexRender(
                header.column.columnDef.header,
                header.getContext(),
              ),
            })) || []
        }
        rows={table.getRowModel().rows.map((row) => ({
          id: row.id,
          cells: row.getVisibleCells().map((cell) => ({
            id: cell.id,
            content: flexRender(
              cell.column.columnDef.cell,
              cell.getContext(),
            ),
          })),
        }))}
        isLoading={isLoading}
        emptyState={emptyState}
      />

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
