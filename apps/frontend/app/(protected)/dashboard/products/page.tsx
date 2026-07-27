export default function ProductsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Productos</h2>
      <p className="text-gray-600 mt-1">
        Lista de productos sincronizados entre tus tiendas.
      </p>
    </div>
  );
}
"use client";
import { useParams } from "next/navigation";
import ProductCatalogPage from "@/components/tenant/ProductCatalogPage";
export default function ProductsPage() { const params = useParams<{ tenantId?: string }>(); return params?.tenantId ? <ProductCatalogPage tenantId={params.tenantId} /> : <div className="p-6"><h2 className="text-2xl font-bold">Productos</h2><p className="mt-1 text-slate-500">Selecciona un tenant para ver su catálogo.</p></div>; }
