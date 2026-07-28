"use client";
import { useParams } from "next/navigation";
import OrdersPage from "@/components/tenant/OrdersPage";
export default function Page() { const { tenantId } = useParams<{ tenantId: string }>(); return <OrdersPage tenantId={tenantId} />; }
