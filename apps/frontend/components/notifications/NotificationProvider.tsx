"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { ListFilter, Loader2, MoreHorizontal } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import DropdownMenuList from "@/components/DropdownMenuList";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/Sheet";
import { useSidebar } from "@/components/ui/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { createSyncSocket } from "@/lib/realtime/sync-socket";
import { CollectionNotification } from "@/components/notifications/CollectionNotification";
import { updateAllNotifications, updateNotification, useNotificationsInfinite, type AppNotification, type NotificationFilter } from "@/hooks/use-notifications";

type NotificationContextValue = {
  unread: number;
  openNotifications: () => void;
  refresh: () => void;
};

const NotificationContext = createContext<NotificationContextValue>({
  unread: 0,
  openNotifications: () => undefined,
  refresh: () => undefined,
});

const triggerClass = "!flex !h-6 !w-6 !items-center !justify-center !p-0 !text-gray-12 !no-underline";

export function NotificationContent({ tenantId, open = true }: { tenantId?: string; open?: boolean }) {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const { notifications, unread, isLoading, isValidating, hasNextPage, loadMore, mutate } = useNotificationsInfinite(tenantId, filter, { refreshInterval: open ? 5000 : 0 });
  const execute = async (action: () => Promise<unknown>) => {
    try {
      setError(null);
      await action();
      void mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible actualizar la notificación.");
    }
  };
  const toggleRead = (n: AppNotification) => tenantId
    ? execute(() => updateNotification(tenantId, n.id, n.readAt ? "unread" : "read", session?.accessToken))
    : Promise.resolve();
  const toggleArchive = (n: AppNotification) => tenantId
    ? execute(() => updateNotification(tenantId, n.id, n.archivedAt ? "unarchive" : "archive", session?.accessToken))
    : Promise.resolve();
  const labels: Record<NotificationFilter, string> = {
    all: "Todas",
    unread: `No leídas${unread ? ` (${unread})` : ""}`,
    read: "Leídas",
    archived: "Archivadas",
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-6 px-3 py-2">
        <div>
          <h2 className="font-bold text-gray-12">Bandeja</h2>
          <p className="text-xs text-gray-10">{unread} pendientes de leer</p>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenuList
            trigger={<Button mode="link" size="icon" aria-label="Filtrar notificaciones" className={triggerClass}><ListFilter className="!size-4 shrink-0 text-gray-12" strokeWidth={2} /></Button>}
            items={[{ type: "label", label: "Filtrar por" }, { type: "separator" }, ...Object.entries(labels).map(([value, label]) => ({ type: "item" as const, label, onSelect: () => setFilter(value as NotificationFilter) }))]}
          />
          <DropdownMenuList
            trigger={<Button mode="link" size="icon" aria-label="Acciones de notificaciones" className={triggerClass}><MoreHorizontal className="!size-4 shrink-0 text-gray-12" strokeWidth={2} /></Button>}
            items={[{ type: "item", label: "Marcar todas como leídas", onSelect: () => tenantId && void execute(() => updateAllNotifications(tenantId, "read", session?.accessToken)) }, { type: "item", label: "Archivar todas", onSelect: () => tenantId && void execute(() => updateAllNotifications(tenantId, "archive", session?.accessToken)) }]}
          />
        </div>
      </div>
      {error && <div className="m-2 rounded-md bg-danger px-2 py-1 text-xs text-danger-contrast">{error}</div>}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? <div className="space-y-1 p-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-8 animate-pulse rounded bg-gray-4" />)}</div> : !notifications.length ? <div className="p-8 text-center text-sm text-gray-11">No hay notificaciones en este filtro.</div> : notifications.map((n) => <CollectionNotification key={n.id} notification={n} onToggleRead={toggleRead} onToggleArchive={toggleArchive} />)}
        {hasNextPage && <div className="p-2"><Button mode="link" className="w-full" onClick={loadMore} disabled={isValidating}>{isValidating ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Cargar más"}</Button></div>}
      </div>
    </div>
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantId?: string }>();
  const tenantId = params?.tenantId;
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const { state } = useSidebar();
  const [open, setOpen] = useState(false);
  const { unread, mutate } = useNotificationsInfinite(tenantId, "all", { refreshInterval: 30000 });

  useEffect(() => {
    if (!session?.accessToken) return;
    const socket = createSyncSocket(session.accessToken);
    const handler = (notification: AppNotification) => {
      void mutate();
      if (["SYNC_ERROR", "CONNECTION_REVOKED", "ORDER_CANCELLED", "INVENTORY_SYNC_ERROR"].includes(notification.type)) toast.error(notification.title, { description: notification.message });
    };
    socket.on("notification.created", handler);
    return () => { socket.off("notification.created", handler); socket.disconnect(); };
  }, [session?.accessToken, mutate]);

  return (
    <NotificationContext.Provider value={{ unread, openNotifications: () => setOpen((current) => !current), refresh: () => void mutate() }}>
      {children}
      <NotificationContextBridge tenantId={tenantId} open={open} setOpen={setOpen} isMobile={isMobile} left={state === "collapsed" ? "5.5rem" : "16rem"} />
    </NotificationContext.Provider>
  );
}

function NotificationContextBridge({ tenantId, open, setOpen, isMobile, left }: { tenantId?: string; open: boolean; setOpen: (value: boolean) => void; isMobile: boolean; left: string }) {
  if (isMobile) return <Sheet open={open} onOpenChange={setOpen}><SheetContent side="right" className="w-[90vw] bg-gray-2 p-0 sm:w-[540px]"><SheetHeader className="sr-only"><SheetTitle>Notificaciones</SheetTitle><SheetDescription>Actividad del tenant</SheetDescription></SheetHeader><NotificationContent tenantId={tenantId} open={open} /></SheetContent></Sheet>;
  return <DialogPrimitive.Root modal={false} open={open} onOpenChange={setOpen}><DialogPrimitive.Portal><div className="fixed inset-0 z-40 bg-gray-a10" style={{ left }} /><DialogPrimitive.Content className="fixed inset-y-0 z-50 w-[400px] border-r border-gray-6 bg-gray-2 p-0 shadow-lg sm:w-[540px]" style={{ left }}><NotificationContent tenantId={tenantId} open={open} /></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}
