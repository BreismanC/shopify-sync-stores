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
import { Search, ChevronDown } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/DropdownMenu";

import { ServerPaginationControls } from "./ServerPaginationControls";
import type { OrderRow, PaginationMeta } from "./types";
import { getOrdersColumns } from "./Columns";

interface DataTableProps {
  orders: OrderRow[];
  pagination: PaginationMeta;
  isLoading: boolean;
  /**
   * `true` cuando ya se completó la primera petición al backend.
   * Mientras sea `false`, se muestra el skeleton aunque `isLoading`
   * sea `false` y `orders` esté vacío, evitando el "flash" del
   * emptyState en el primer render del cliente tras recargar.
   */
  hasFetchedOnce?: boolean;
  search: string;
  sortBy: string;
  order: "asc" | "desc";
  /**
   * Builder del href para el detalle de la orden, se inyecta desde
   * el cliente según el contexto (`/orders/:id` o `/tenant/:tenantId/orders/:id`).
   */
  buildDetailHref: (orderId: string) => string;
  onSearchChange: (v: string) => void;
  onSortChange: (sortBy: string, order: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
}

type SortKey =
  | "createdAt:desc"
  | "createdAt:asc"
  | "status:asc"
  | "status:desc"
  | "updatedAt:asc"
  | "updatedAt:desc";

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "Más recientes", value: "createdAt:desc" },
  { label: "Más antiguos", value: "createdAt:asc" },
  { label: "Fecha A → Z", value: "updatedAt:asc" },
  { label: "Fecha Z → A", value: "updatedAt:desc" },
  { label: "Estado A → Z", value: "status:asc" },
  { label: "Estado Z → A", value: "status:desc" },
];

export default function DataTable({
  orders,
  pagination,
  isLoading,
  hasFetchedOnce = false,
  search,
  sortBy,
  order,
  buildDetailHref,
  onSearchChange,
  onSortChange,
  onPageChange,
}: DataTableProps) {
  const columns = useMemo<ColumnDef<OrderRow>[]>(
    () =>
      getOrdersColumns({
        buildDetailHref,
      }),
    [buildDetailHref],
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedGlobalFilter, setDebouncedGlobalFilter] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedGlobalFilter(globalFilter), 300);
    return () => clearTimeout(t);
  }, [globalFilter]);

  const table = useReactTable({
    data: orders,
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
    [currentSort],
  );

  const emptyState = (
    <tr>
      <td
        colSpan={columns.length}
        className="px-6 py-16 text-center text-sm text-gray-500"
      >
        No hay pedidos sincronizados.
      </td>
    </tr>
  );

  return (
    <div className="p-12 space-y-8">
      {/* Page Heading */}
      <header className="flex flex-col sm:flex-row flex-wrap justify-between items-start gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Pedidos
          </h1>
          <p className="text-base font-normal text-gray-500">
            Pedidos sincronizados y liquidaciones.
          </p>
        </div>
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
                  placeholder="Buscar por número de orden (ej: #1234)"
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
                      const [sb, od] = opt.value.split(":") as [
                        string,
                        "asc" | "desc",
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
                emptyState
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
    </div>
  );
}
