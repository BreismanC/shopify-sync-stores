"use client";
import { useParams } from "next/navigation";
import ProductCatalogPage from "@/components/tenant/ProductCatalogPage";
export default function Page() { const params = useParams<{ tenantId?: string }>(); return params?.tenantId ? <ProductCatalogPage tenantId={params.tenantId} /> : <div className="p-6"><h2 className="text-2xl font-bold">Productos</h2></div>; }
