"use client";
import { useParams } from "next/navigation";
import NotificationsPage from "@/components/tenant/NotificationsPage";
export default function Page() { const { tenantId } = useParams<{ tenantId: string }>(); return <NotificationsPage tenantId={tenantId} />; }
