"use client";

import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";

interface StoreKeyCardProps {
  storeKey: string;
}

export function StoreKeyCard({ storeKey }: StoreKeyCardProps) {
  const copyStoreKey = async () => {
    try {
      await navigator.clipboard.writeText(storeKey);
      toast.success("Clave copiada al portapapeles");
    } catch {
      toast.error("No se pudo copiar la clave");
    }
  };

  return (
    <Card className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <KeyRound className="size-5 text-gray-11" aria-hidden="true" />
        <h3 className="text-base font-semibold text-gray-12">
          Clave única de tienda
        </h3>
      </div>
      <p className="mt-2 text-sm leading-5 text-gray-11">
        Compartila con tiendas Source para que puedan importar productos a tu
        tienda.
      </p>
      <div className="mt-7 flex items-center gap-3">
        <code className="min-w-0 flex-1 truncate font-mono text-base font-semibold text-gray-12">
          {storeKey}
        </code>
        <button
          type="button"
          onClick={copyStoreKey}
          aria-label="Copiar clave de tienda"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
        >
          <Copy className="size-4" />
        </button>
      </div>
    </Card>
  );
}
