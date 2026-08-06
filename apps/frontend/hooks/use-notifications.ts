"use client";

import { useSession } from "next-auth/react";
import useSWRInfinite from "swr/infinite";
import { fetchWithAuth } from "@/lib/auth/fetch-with-auth";

export type NotificationFilter = "all" | "unread" | "read" | "archived";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  userId?: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface NotificationResponse {
  data: AppNotification[];
  total: number;
  unread: number;
}

const PAGE_SIZE = 20;

export function useNotificationsInfinite(
  tenantId: string | undefined,
  filter: NotificationFilter,
  options?: { refreshInterval?: number },
) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const getKey = (pageIndex: number, previous: NotificationResponse | null) => {
    if (previous && previous.data.length < PAGE_SIZE) return null;
    if (!tenantId || status !== "authenticated" || !token) return null;
    return [`/api/tenant/${tenantId}/notifications?state=${filter}&page=${pageIndex + 1}&perPage=${PAGE_SIZE}`, token] as const;
  };
  const swr = useSWRInfinite<NotificationResponse>(
    getKey,
    ([url, accessToken]) => fetchWithAuth<NotificationResponse>(url, {}, String(accessToken)),
    { refreshInterval: options?.refreshInterval ?? 0, revalidateOnFocus: true },
  );
  const pages = swr.data ?? [];
  const notifications = pages.flatMap((page) => page.data);
  const unread = pages[0]?.unread ?? 0;
  const lastPage = pages[pages.length - 1];
  const hasNextPage = Boolean(lastPage && lastPage.data.length === PAGE_SIZE);
  return {
    ...swr,
    notifications,
    unread,
    hasNextPage,
    loadMore: () => void swr.setSize(swr.size + 1),
  };
}

export async function updateNotification(
  tenantId: string,
  id: string,
  action: "read" | "unread" | "archive" | "unarchive",
  accessToken?: string,
) {
  return fetchWithAuth<AppNotification>(
    `/api/tenant/${tenantId}/notifications/${id}/${action}`,
    { method: "PATCH" },
    accessToken,
  );
}

export async function updateAllNotifications(
  tenantId: string,
  action: "read" | "archive",
  accessToken?: string,
) {
  return fetchWithAuth<{ updated: number }>(
    `/api/tenant/${tenantId}/notifications/${action}-all`,
    { method: "POST" },
    accessToken,
  );
}
