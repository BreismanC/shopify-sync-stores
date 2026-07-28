"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { apiFetch, fetchWithAuth } from "@/lib/auth/fetch-with-auth";
import { BACKEND_URL } from "@/lib/env";
import { createSyncSocket } from "@/lib/realtime/sync-socket";

export type WebhookStatus =
  | "PENDING"
  | "CONNECTED"
  | "REGISTERED_WITHOUT_ID"
  | "FAILED";

export type WebhookTopic =
  | "PRODUCTS_CREATE"
  | "PRODUCTS_UPDATE"
  | "PRODUCTS_DELETE"
  | "INVENTORY_LEVELS_UPDATE"
  | "ORDERS_CREATE"
  | "ORDERS_UPDATED"
  | "ORDERS_CANCELLED"
  | "APP_UNINSTALLED";

export interface StoreWebhookRow {
  id: string;
  storeId: string;
  topic: WebhookTopic;
  callbackUrl: string;
  shopifyWebhookId: string | null;
  status: WebhookStatus;
  lastError: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const TOPIC_LABELS: Record<WebhookTopic, string> = {
  PRODUCTS_CREATE: "Productos (crear)",
  PRODUCTS_UPDATE: "Productos (actualizar)",
  PRODUCTS_DELETE: "Productos (eliminar)",
  INVENTORY_LEVELS_UPDATE: "Niveles de inventario",
  ORDERS_CREATE: "Pedidos (crear)",
  ORDERS_UPDATED: "Pedidos (actualizar)",
  ORDERS_CANCELLED: "Pedidos (cancelados)",
  APP_UNINSTALLED: "App desinstalada",
};

const STATUS_LABELS: Record<WebhookStatus, string> = {
  PENDING: "Pendiente",
  CONNECTED: "Conectado",
  REGISTERED_WITHOUT_ID: "Sin ID",
  FAILED: "Falló",
};

function statusBadge(status: WebhookStatus) {
  switch (status) {
    case "CONNECTED":
      return <Badge status="success">{STATUS_LABELS[status]}</Badge>;
    case "PENDING":
      return <Badge status="info">{STATUS_LABELS[status]}</Badge>;
    case "FAILED":
      return <Badge status="danger">{STATUS_LABELS[status]}</Badge>;
    case "REGISTERED_WITHOUT_ID":
      return <Badge status="warning">{STATUS_LABELS[status]}</Badge>;
    default:
      return <Badge status="default">{status}</Badge>;
  }
}

function StatusIcon({ status }: { status: WebhookStatus }) {
  if (status === "PENDING")
    return (
      <Loader2
        className="h-4 w-4 animate-spin text-info"
        aria-label="Pendiente"
      />
    );
  if (status === "CONNECTED")
    return (
      <CheckCircle2
        className="h-4 w-4 text-success"
        aria-label="Conectado"
      />
    );
  return (
    <XCircle className="h-4 w-4 text-danger" aria-label="Falló" />
  );
}

export interface StoreWebhooksDetailsProps {
  /**
   * Si `true`, el collapsible arranca expandido para que el usuario vea
   * el avance del registro apenas termine de pulsar Continuar.
   */
  initiallyOpen?: boolean;
  /**
   * `accessToken` lo prefiere el componente si ya está disponible en el
   * padre (evita un `useSession()` redundante). Si no se pasa, lo obtiene
   * él mismo.
   */
  accessToken?: string;
  /** Notifica al padre cuántos webhooks están conectados. */
  onChange?: (summary: WebhooksSummary) => void;
}

export interface WebhooksSummary {
  total: number;
  connected: number;
  pending: number;
  failed: number;
  allConnected: boolean;
}

const DEFAULT_OPEN_TOPICS: WebhookTopic[] = [];

function summarize(rows: StoreWebhookRow[]): WebhooksSummary {
  const total = rows.length;
  const connected = rows.filter((r) => r.status === "CONNECTED").length;
  const pending = rows.filter((r) => r.status === "PENDING").length;
  const failed = rows.filter(
    (r) => r.status === "FAILED" || r.status === "REGISTERED_WITHOUT_ID",
  ).length;
  return {
    total,
    connected,
    pending,
    failed,
    allConnected: total > 0 && connected === total,
  };
}

export function StoreWebhooksDetails({
  initiallyOpen = false,
  accessToken,
  onChange,
}: StoreWebhooksDetailsProps) {
  const { data: session } = useSession();
  const token = accessToken ?? session?.accessToken;
  const [open, setOpen] = useState(initiallyOpen);
  const [rows, setRows] = useState<StoreWebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const summary = useMemo(() => summarize(rows), [rows]);

  useEffect(() => {
    onChange?.(summary);
  }, [summary, onChange]);

  const fetchWebhooks = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ webhooks: StoreWebhookRow[] }>(
        `${BACKEND_URL}/api/onboarding/store/webhooks`,
        { method: "GET" },
        token,
      );
      setRows(data.webhooks ?? []);
    } catch (err) {
      console.error("No se pudieron obtener los webhooks:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchWebhooks();
  }, [fetchWebhooks]);

  useEffect(() => {
    if (!token) return;
    const socket: Socket = createSyncSocket(token);
    const handler = (payload: { webhook: StoreWebhookRow }) => {
      if (!payload?.webhook) return;
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.topic === payload.webhook.topic);
        if (idx === -1) return [...prev, payload.webhook];
        const next = prev.slice();
        next[idx] = payload.webhook;
        return next;
      });
    };
    socket.on("store.webhook.upsert", handler);
    return () => {
      socket.off("store.webhook.upsert", handler);
      socket.disconnect();
    };
  }, [token]);

  const handleRetry = async () => {
    if (!token) return;
    setRetrying(true);
    try {
      const json = await fetchWithAuth<{ webhooks: StoreWebhookRow[] }>(
        `${BACKEND_URL}/api/onboarding/store/webhooks/retry`,
        { method: "POST" },
        token,
      );
      setRows(json.webhooks ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al reintentar",
      );
    } finally {
      setRetrying(false);
    }
  };

  const orderedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.topic.localeCompare(b.topic));
  }, [rows]);

  const hasFailed =
    summary.failed > 0 ||
    rows.some((r) => r.status === "REGISTERED_WITHOUT_ID");

  return (
    <section
      className="mt-6 rounded-lg border border-gray-6 bg-gray-2"
      aria-label="Detalles de webhooks"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-12 hover:bg-gray-3/60"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
          Detalles
          <span className="text-xs font-normal text-gray-11">
            · {summary.connected}/{summary.total || 0} conectados
            {summary.pending > 0 ? ` · ${summary.pending} pendientes` : ""}
            {summary.failed > 0 ? ` · ${summary.failed} fallaron` : ""}
          </span>
        </span>
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${
            summary.allConnected
              ? "bg-success"
              : hasFailed
                ? "bg-danger"
                : "bg-info"
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-gray-6 px-4 py-3 text-sm">
          {loading && orderedRows.length === 0 ? (
            <div className="flex items-center gap-2 py-3 text-gray-11">
              <Loader2 className="h-4 w-4 animate-spin" />
              Consultando webhooks…
            </div>
          ) : orderedRows.length === 0 ? (
            <p className="text-gray-11">
              Aún no hay webhooks registrados para esta tienda. Conectá la
              tienda para empezar.
            </p>
          ) : (
            <ul className="space-y-2">
              {orderedRows.map((row) => (
                <li
                  key={row.id ?? `${row.storeId}-${row.topic}`}
                  className="flex items-start justify-between gap-3 rounded-md border border-gray-6 bg-gray-1 px-3 py-2"
                >
                  <div className="flex items-start gap-2">
                    <StatusIcon status={row.status} />
                    <div>
                      <p className="font-medium text-gray-12">
                        {TOPIC_LABELS[row.topic] ?? row.topic}
                      </p>
                      <p className="text-xs text-gray-11">
                        <code className="break-all">{row.callbackUrl}</code>
                      </p>
                      {row.lastError ? (
                        <p className="mt-1 text-xs text-danger">
                          {row.lastError}
                        </p>
                      ) : null}
                      {row.shopifyWebhookId ? (
                        <p className="mt-1 text-xs text-gray-11">
                          Shopify ID:{" "}
                          <code className="break-all">
                            {row.shopifyWebhookId}
                          </code>
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {statusBadge(row.status)}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              mode="link"
              size="sm"
              onClick={() => void fetchWebhooks()}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refrescar
            </Button>
            <Button
              type="button"
              variant="pill"
              size="sm"
              onClick={() => void handleRetry()}
              disabled={retrying || !hasFailed}
              className="border border-gray-6 bg-gray-1 text-gray-12 hover:bg-gray-3"
            >
              {retrying ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              Reintentar fallidos
            </Button>
          </div>

          {!summary.allConnected && summary.failed > 0 ? (
            <p className="mt-3 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
              Hay {summary.failed} webhook(s) obligatorio(s) que fallaron. No
              podés avanzar al paso 4 hasta que se conecten. Usá el botón
              “Reintentar fallidos” o verificá que el access token tenga el
              scope <code>write_webhooks</code>.
            </p>
          ) : !summary.allConnected ? (
            <p className="mt-3 text-xs text-gray-11">
              Esperando que Shopify confirme la suscripción de cada webhook.
              Esta vista se actualiza automáticamente.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
