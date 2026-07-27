"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { BACKEND_URL } from "@/lib/env";
import { fetchWithAuth, useAuthFetch } from "@/lib/auth/fetch-with-auth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

interface NotificationResponse {
  data: AppNotification[];
  total: number;
  unread: number;
}
interface NotificationContextValue {
  unread: number;
  notifications: AppNotification[];
  openNotifications: () => void;
  refresh: () => void;
  socket: Socket | null;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ tenantId?: string }>();
  const tenantId = params?.tenantId;
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const endpoint = tenantId
    ? `/api/tenant/${tenantId}/notifications?state=all&perPage=50`
    : null;
  const { data, mutate } = useAuthFetch<NotificationResponse>(endpoint, {
    refreshInterval: 30_000,
  });

  useEffect(() => {
    if (!tenantId || !session?.accessToken) return;
    const client = io(`${BACKEND_URL}/sync`, {
      auth: { token: session.accessToken },
      transports: ["websocket", "polling"],
    });
    const refresh = () => void mutate();
    client.on("notification.created", (notification: AppNotification) => {
      refresh();
      if (
        ["SYNC_ERROR", "CONNECTION_REVOKED", "ORDER_CANCELED"].includes(
          notification.type,
        )
      )
        toast.error(notification.title, { description: notification.message });
    });
    client.on("sync.batch.progress", refresh);
    setSocket(client);
    return () => {
      client.disconnect();
      setSocket(null);
    };
  }, [tenantId, session?.accessToken, mutate]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unread: data?.unread ?? 0,
      notifications: data?.data ?? [],
      openNotifications: () => setOpen(true),
      refresh: () => void mutate(),
      socket,
    }),
    [data, mutate, socket],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-gray-6 p-4">
            <SheetTitle>Notificaciones</SheetTitle>
            <SheetDescription>
              {value.unread} pendientes de leer
            </SheetDescription>
          </SheetHeader>
          <NotificationList
            notifications={value.notifications}
            tenantId={tenantId}
            accessToken={session?.accessToken}
            onUpdated={() => void mutate()}
          />
        </SheetContent>
      </Sheet>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return (
    useContext(NotificationContext) ?? {
      unread: 0,
      notifications: [],
      openNotifications: () => undefined,
      refresh: () => undefined,
      socket: null,
    }
  );
}

export function NotificationList({
  notifications,
  tenantId,
  accessToken,
  onUpdated,
}: {
  notifications: AppNotification[];
  tenantId?: string;
  accessToken?: string;
  onUpdated?: () => void;
}) {
  const update = useCallback(
    async (id: string, action: "read" | "archive") => {
      if (!tenantId) return;
      await fetchWithAuth(
        `/api/tenant/${tenantId}/notifications/${id}/${action}`,
        { method: "PATCH" },
        accessToken,
      );
      onUpdated?.();
    },
    [accessToken, onUpdated, tenantId],
  );
  if (!notifications.length)
    return (
      <div className="p-6 text-center text-sm text-gray-11">
        No hay notificaciones todavía.
      </div>
    );
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2">
      {notifications.map((notification) => (
        <article
          key={notification.id}
          className="rounded-lg border border-gray-6 bg-gray-1 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-12">
                  {notification.title}
                </h3>
                {!notification.readAt && <Badge status="info">Nueva</Badge>}
              </div>
              <p className="mt-1 text-sm text-gray-11">
                {notification.message}
              </p>
              {typeof notification.payload?.storeKey === "string" && (
                <div className="mt-3 rounded-md border border-accent-6 bg-accent-2 p-2">
                  <p className="text-xs font-medium text-gray-11">
                    Clave única de la tienda
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold text-gray-12">
                    {notification.payload.storeKey}
                  </p>
                  <p className="mt-1 text-xs text-gray-11">
                    Usá esta clave en “Conectar con clave”.
                  </p>
                </div>
              )}
              <time className="mt-2 block text-xs text-gray-9">
                {new Date(notification.createdAt).toLocaleString("es-CO")}
              </time>
            </div>
            <div className="flex gap-1">
              {!notification.readAt && (
                <Button
                  mode="link"
                  size="xs"
                  onClick={() => void update(notification.id, "read")}
                >
                  Leer
                </Button>
              )}
              <Button
                mode="link"
                size="xs"
                onClick={() => void update(notification.id, "archive")}
              >
                Archivar
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
