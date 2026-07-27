"use client";
import { useParams } from "next/navigation";
import OrdersPage from "@/components/tenant/OrdersPage";
export default function Page() { const { tenantId } = useParams<{ tenantId?: string }>(); return tenantId ? <OrdersPage tenantId={tenantId} /> : <div className="p-6"><h2 className="text-2xl font-bold">Pedidos</h2></div>; }
