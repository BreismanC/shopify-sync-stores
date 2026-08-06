"use client";

import { useState } from "react";
import { Archive, Check, Circle, ExternalLink, RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/utils/class-names";
import type { AppNotification } from "@/hooks/use-notifications";

export function CollectionNotification({
  notification,
  onToggleRead,
  onToggleArchive,
}: {
  notification: AppNotification;
  onToggleRead: (notification: AppNotification) => Promise<void>;
  onToggleArchive: (notification: AppNotification) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const payload = notification.payload ?? {};
  const run = async (action: () => Promise<void>) => {
    if (updating) return;
    setUpdating(true);
    try {
      await action();
    } finally {
      setUpdating(false);
    }
  };

  const actionButtonClass = "!h-6 !w-6 !min-h-0 !border-gray-7 !bg-gray-2 !p-0 !text-gray-10 hover:!bg-gray-4 hover:!text-gray-12";
  const iconClass = "!size-4 text-gray-10";

  return (
    <article className={cn("group relative border-b border-gray-6 px-2 py-2 transition-colors hover:bg-gray-3", !notification.readAt && "bg-accent-2/40")}>
      <time className="absolute right-2 top-2 text-xs text-gray-9">
        {new Date(notification.createdAt).toLocaleString("es-CO")}
      </time>
      {!notification.readAt && <span className="absolute right-2 top-7 h-1.5 w-1.5 rounded-full bg-accent-9" />}
      <div className="max-w-[82%] space-y-1">
        <p className="flex items-center gap-1 text-sm font-semibold text-gray-12">
          {notification.title}
          {typeof payload.link === "string" && <ExternalLink className="size-3" aria-hidden />}
        </p>
        <p className="text-sm text-gray-11">{notification.message}</p>
        {typeof payload.storeKey === "string" && <div className="rounded-md border border-accent-6 bg-accent-2 p-2 text-xs"><b>Clave única:</b> <span className="break-all font-mono">{String(payload.storeKey)}</span></div>}
        {!!(payload.sourceStoreName || payload.vendorStoreName || payload.sourceStoreId || payload.vendorStoreId) && <p className="text-xs text-gray-10"><b>Tiendas:</b> {String(payload.sourceStoreName ?? payload.sourceStoreId ?? "source")} → {String(payload.vendorStoreName ?? payload.vendorStoreId ?? "vendor")}</p>}
        {!!(payload.processed !== undefined || payload.succeeded !== undefined || payload.failed !== undefined || payload.skipped !== undefined) && <p className="text-xs text-gray-10"><b>Resumen:</b> {String(payload.processed ?? 0)} procesados · {String(payload.succeeded ?? 0)} exitosos · {String(payload.failed ?? 0)} fallidos · {String(payload.skipped ?? 0)} omitidos</p>}
        {!!(payload.vendorOrderId || payload.syncedOrderId) && <p className="text-xs text-gray-10"><b>Pedido:</b> {String(payload.vendorOrderId ?? payload.syncedOrderId)}</p>}
        {!!payload.payoutStatus && <p className="text-xs text-gray-10"><b>Payout:</b> {String(payload.payoutStatus)}</p>}
      </div>
      <div className="mt-1 flex justify-end gap-2 opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100">
        <Button mode="pill" size="icon" className={actionButtonClass} disabled={updating} aria-label={notification.readAt ? "Marcar como no leída" : "Marcar como leída"} onClick={() => void run(() => onToggleRead(notification))}>
          {notification.readAt ? <Circle className={iconClass} strokeWidth={2} /> : <Check className={iconClass} strokeWidth={2} />}
        </Button>
        <Button mode="pill" size="icon" className={actionButtonClass} disabled={updating} aria-label={notification.archivedAt ? "Desarchivar" : "Archivar"} onClick={() => void run(() => onToggleArchive(notification))}>
          {notification.archivedAt ? <RotateCcw className={iconClass} strokeWidth={2} /> : <Archive className={iconClass} strokeWidth={2} />}
        </Button>
      </div>
    </article>
  );
}
