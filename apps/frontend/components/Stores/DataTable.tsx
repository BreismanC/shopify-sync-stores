"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { Search, Plus, ChevronDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ResponsiveTableCard,
} from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/DropdownMenu";

import ConnectStoreButton from "./ConnectStoreButton";
import type { Store } from "@/app/(protected)/stores/stores-client";
import type { PaginationMeta } from "./types";
import { getStoresColumns } from "./Columns";
import { ServerPaginationControls } from "./ServerPaginationControls";

interface DataTableProps {
  stores: Store[];
  pagination: PaginationMeta;
  isLoading: boolean;
  search: string;
  sortBy: string;
  order: "asc" | "desc";
  onSearchChange: (v: string) => void;
  onSortChange: (sortBy: string, order: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
}

type SortKey =
  | "createdAt:desc"
  | "createdAt:asc"
  | "shopifyShopId:asc"
  | "shopifyShopId:desc";

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "Más recientes", value: "createdAt:desc" },
  { label: "Más antiguos", value: "createdAt:asc" },
  { label: "A → Z", value: "shopifyShopId:asc" },
  { label: "Z → A", value: "shopifyShopId:desc" },
];

export default function DataTable({
  stores,
  pagination,
  isLoading,
  search,
  sortBy,
  order,
  onSearchChange,
  onSortChange,
  onPageChange,
}: DataTableProps) {
  const columns = useMemo<ColumnDef<Store>[]>(() => getStoresColumns(), []);

  // TanStack Table state — sorting + global filter (debounced manually)
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedGlobalFilter, setDebouncedGlobalFilter] = useState("");

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
      "Más recientes",
    [currentSort]
  );

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-12">Tiendas</h2>
          <p className="text-gray-11 mt-1">
            Conecta y administra tus tiendas Shopify sincronizadas.
          </p>
          <a
            href="#"
            className="text-primary hover:underline text-sm mt-1 inline-block"
          >
            Aprende sobre conectar tiendas
          </a>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-gray-9" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar tienda"
              className="pl-7 w-[240px]"
            />
          </div>

          {/* Sort dropdown */}
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
                    const [sb, od] = opt.value.split(":") as [
                      string,
                      "asc" | "desc"
                    ];
                    onSortChange(sb, od);
                  }}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <ConnectStoreButton />
        </div>
      </div>

      {/* Table */}
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
                          header.getContext()
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
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Empty>
                    <EmptyMedia>
                      <Plus className="size-5 text-gray-9" />
                    </EmptyMedia>
                    <EmptyHeader>
                      <EmptyTitle>No hay tiendas conectadas</EmptyTitle>
                      <EmptyDescription>
                        Conecta tu primera tienda Shopify haciendo clic en
                        &apos;Connect new store&apos;.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Responsive mobile cards */}
      <ResponsiveTableCard
        headers={
          table
            .getHeaderGroups()[0]
            ?.headers.filter((header) => !header.isPlaceholder)
            .map((header) => ({
              id: header.id,
              header: flexRender(
                header.column.columnDef.header,
                header.getContext()
              ),
            })) || []
        }
        rows={table.getRowModel().rows.map((row) => ({
          id: row.id,
          cells: row.getVisibleCells().map((cell) => ({
            id: cell.id,
            content: flexRender(cell.column.columnDef.cell, cell.getContext()),
          })),
        }))}
        isLoading={isLoading}
        emptyState={
          <Empty>
            <EmptyMedia>
              <Plus className="size-5 text-gray-9" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No hay tiendas conectadas</EmptyTitle>
              <EmptyDescription>
                Conecta tu primera tienda Shopify haciendo clic en
                &apos;Connect new store&apos;.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />

      {/* Pagination */}
      <ServerPaginationControls
        pagination={pagination}
        currentPage={pagination.page}
        onPageChange={onPageChange}
      />
    </div>
  );
}