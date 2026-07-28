"use client";
import { useParams } from "next/navigation";
import NotificationsPage from "@/components/tenant/NotificationsPage";
export default function Page() { const { tenantId } = useParams<{ tenantId?: string }>(); return tenantId ? <NotificationsPage tenantId={tenantId} /> : <div className="p-6"><h2 className="text-2xl font-bold">Notificaciones</h2></div>; }
