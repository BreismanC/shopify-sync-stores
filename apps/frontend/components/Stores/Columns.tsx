'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  ShoppingBag,
  Loader2,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu';
import type { ConnectionRow, StoreRole } from './types';
import type { CurrentStore } from '@/lib/store/current';

interface StoresColumnsCallbacks {
  onViewProducts: (row: ConnectionRow) => void;
  onDisconnect: (row: ConnectionRow) => void;
  currentStore: CurrentStore | null;
}

export function getStoreName(shopifyShopId: string): string {
  const idx = shopifyShopId.indexOf('.myshopify.com');
  return idx > -1 ? shopifyShopId.slice(0, idx) : shopifyShopId;
}

function counterpartyRoleLabel(current: StoreRole): string {
  return current === 'SOURCE' ? 'Vendor' : 'Source';
}

export function getStoresColumns(
  callbacks: StoresColumnsCallbacks,
): ColumnDef<ConnectionRow>[] {
  const { onViewProducts, onDisconnect, currentStore } = callbacks;

  return [
    {
      id: 'platform',
      header: () => (
        <span className="text-xs font-medium text-gray-11">Platform</span>
      ),
      cell: () => (
        <div className="flex items-center justify-center size-6 rounded-md bg-accent-3">
          <ShoppingBag className="size-3.5 text-accent-9" />
        </div>
      ),
      enableSorting: false,
    },
    {
      id: 'store',
      header: () => (
        <span className="text-xs font-medium text-gray-11">Store</span>
      ),
      accessorFn: (row) => getStoreName(row.shopifyShopId),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-12">
            {getStoreName(row.original.shopifyShopId)}
          </span>
          <span className="text-xs text-gray-11">
            {row.original.shopifyShopId}
          </span>
        </div>
      ),
    },
    {
      id: 'role',
      header: () => (
        <span className="text-xs font-medium text-gray-11">Counterparty</span>
      ),
      cell: () => (
        <span className="inline-flex items-center gap-1 rounded-md border border-gray-a6 bg-gray-2 px-2 py-0.5 text-xs font-medium text-gray-11">
          <ChevronRight className="size-3" aria-hidden="true" />
          {counterpartyRoleLabel(
            (currentStore?.role ?? 'SOURCE') as StoreRole,
          )}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: 'inventoryLocation',
      header: () => (
        <span className="text-xs font-medium text-gray-11">
          Inventory Location
        </span>
      ),
      cell: () => (
        <div className="flex items-center gap-2">
          <Select disabled>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
            </SelectContent>
          </Select>
          <Loader2 className="size-3 animate-spin text-gray-9" />
        </div>
      ),
      enableSorting: false,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            mode="pill"
            size="sm"
            onClick={() => onViewProducts(row.original)}
            aria-label="Ver productos"
          >
            View products
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                mode="link"
                size="icon"
                className="size-6"
                aria-label="Más acciones"
              >
                <MoreHorizontal className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onViewProducts(row.original)}>
                View products
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger-contrast focus:text-danger-contrast"
                onSelect={() => onDisconnect(row.original)}
              >
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      enableSorting: false,
    },
  ];
}

export { ChevronDown };
