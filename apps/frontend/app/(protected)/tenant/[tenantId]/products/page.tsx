"use client";
import { useParams } from "next/navigation";
import ProductCatalogPage from "@/components/tenant/ProductCatalogPage";
export default function ProductsPage() { const { tenantId } = useParams<{ tenantId: string }>(); return <ProductCatalogPage tenantId={tenantId} />; }
