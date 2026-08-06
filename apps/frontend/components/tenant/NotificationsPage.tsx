"use client";

import { NotificationContent } from "@/components/notifications/NotificationProvider";

export default function NotificationsPage({ tenantId }: { tenantId: string }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1100px] flex-col gap-4 rounded-xl bg-gray-2 p-4 text-gray-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-9">Actividad</p>
        <h1 className="mt-1 text-2xl font-bold">Centro de actividades</h1>
        <p className="mt-1 text-sm text-gray-10">Notificaciones de sincronizaciones, conexiones, pedidos, inventario y payouts.</p>
      </header>
      <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-6 bg-gray-1">
        <NotificationContent tenantId={tenantId} />
      </section>
    </main>
  );
}
