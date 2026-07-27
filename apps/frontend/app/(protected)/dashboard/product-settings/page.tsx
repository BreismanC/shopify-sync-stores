export default function ProductSettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">
        Configuración de productos
      </h2>
      <p className="text-gray-600 mt-1">
        Define qué atributos de producto se sincronizan entre tiendas.
      </p>
    </div>
  );
}
"use client";
import { useParams } from "next/navigation";
import ProductSettingsPage from "@/components/tenant/ProductSettingsPage";
export default function Page() { const { tenantId } = useParams<{ tenantId?: string }>(); return tenantId ? <ProductSettingsPage tenantId={tenantId} /> : <div className="p-6"><h2 className="text-2xl font-bold">Configuración de productos</h2></div>; }
