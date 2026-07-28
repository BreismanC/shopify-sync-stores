"use client";
import { useParams } from "next/navigation";
import ProductSettingsPage from "@/components/tenant/ProductSettingsPage";
export default function Page() { const { tenantId } = useParams<{ tenantId?: string }>(); return tenantId ? <ProductSettingsPage tenantId={tenantId} /> : <div className="p-6"><h2 className="text-2xl font-bold">Configuración de productos</h2></div>; }
