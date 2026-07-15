"use client";

import { KeyRound, Copy } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";

interface StoreKeyCardProps {
  storeKey: string;
  description?: string;
}

export function StoreKeyCard({
  storeKey,
  description = "Compartila con tiendas Source para que puedan importar productos a tu tienda.",
}: StoreKeyCardProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(storeKey);
      toast.success("Clave copiada al portapapeles");
    } catch {
      toast.error("No se pudo copiar la clave");
    }
  };

  return (
    <Card className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 text-on-surface-variant" aria-hidden />
        <h3 className="text-base font-semibold text-on-background">
          Clave única de tienda
        </h3>
      </div>
      <p className="mt-2 text-sm leading-5 text-on-surface-variant">
        {description}
      </p>
      <div className="mt-7 flex items-center gap-3">
        <code className="flex-1 font-mono text-base font-semibold text-on-background">
          {storeKey}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar clave"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-background"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
