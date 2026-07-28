"use client";
import { useParams } from "next/navigation";
import ProductSettingsPage from "@/components/tenant/ProductSettingsPage";
export default function Page() { const { tenantId } = useParams<{ tenantId: string }>(); return <ProductSettingsPage tenantId={tenantId} />; }
