export default function OrdersPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Pedidos</h2>
      <p className="text-gray-600 mt-1">
        Pedidos sincronizados entre tus tiendas conectadas.
      </p>
    </div>
  );
}
"use client";
import { useParams } from "next/navigation";
import OrdersPage from "@/components/tenant/OrdersPage";
export default function Page() { const { tenantId } = useParams<{ tenantId?: string }>(); return tenantId ? <OrdersPage tenantId={tenantId} /> : <div className="p-6"><h2 className="text-2xl font-bold">Pedidos</h2></div>; }
