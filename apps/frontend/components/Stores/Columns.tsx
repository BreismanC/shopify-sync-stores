"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ShoppingBag, Loader2, MoreHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import type { Store } from "@/app/(protected)/stores/stores-client";

export function getStoreName(shopifyShopId: string): string {
  const idx = shopifyShopId.indexOf(".myshopify.com");
  return idx > -1 ? shopifyShopId.slice(0, idx) : shopifyShopId;
}

export const getStoresColumns = (): ColumnDef<Store>[] => [
  {
    id: "platform",
    header: () => (
      <span className="text-xs font-medium text-gray-11">Platform</span>
    ),
    cell: () => (
      <div className="flex items-center justify-center size-6 rounded-md bg-green-3">
        <ShoppingBag className="size-3.5 text-green-9" />
      </div>
    ),
    enableSorting: false,
  },
  {
    id: "store",
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
    id: "inventoryLocation",
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
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: () => (
      <div className="flex items-center gap-2 justify-end">
        <Button mode="pill" size="sm">
          View products
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button mode="link" size="icon" className="size-6">
              <MoreHorizontal className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View products</DropdownMenuItem>
            <DropdownMenuItem>Disconnect</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    enableSorting: false,
  },
];

// Re-export for compatibility (silences unused import warnings if any)
export { ChevronDown };