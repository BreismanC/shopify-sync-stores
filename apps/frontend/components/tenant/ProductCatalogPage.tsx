"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { io } from "socket.io-client";
import { BACKEND_URL } from "@/lib/env";
import { fetchWithAuth, useAuthFetch } from "@/lib/auth/fetch-with-auth";

type Source = { source: { id: string; name?: string; role?: string; storeKey?: string }; kind: string; productCount?: number };
type Product = { id: string; title: string; status?: string; createdAt?: string; updatedAt?: string; images?: unknown; variants?: Array<{ sku?: string; price?: string | number }> };
type ProductResponse = { data: Product[]; total: number; pagination?: { totalPages: number } };

export default function ProductCatalogPage({ tenantId }: { tenantId: string }) {
  const { data: session } = useSession();
  const [sourceId, setSourceId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const { data: sourcesResponse, mutate: refreshSources } = useAuthFetch<{ data?: Source[] }>(`/api/tenant/${tenantId}/product-sources`);
  const sources = sourcesResponse?.data ?? [];
  const endpoint = sourceId !== "ALL"
    ? `/api/tenant/${tenantId}/products?sourceStoreId=${sourceId}&search=${encodeURIComponent(search)}&page=${page}&perPage=20&sortBy=${sortBy}&order=${order}`
    : null;
  const { data: productResponse, mutate: refreshProducts, isLoading } = useAuthFetch<ProductResponse>(endpoint);
  const products = productResponse?.data ?? [];
  const totalPages = productResponse?.pagination?.totalPages ?? Math.max(1, Math.ceil((productResponse?.total ?? 0) / 20));

  useEffect(() => {
    if (sourceId === "ALL" && sources.length) setSourceId(sources[0].source.id);
  }, [sources, sourceId]);
  useEffect(() => {
    if (!session?.accessToken) return;
    const socket = io(`${BACKEND_URL}/sync`, { auth: { token: session.accessToken }, transports: ["websocket", "polling"] });
    socket.on("sync.batch.progress", (event: { status?: string; processed?: number; total?: number }) => {
      if (event.status === "COMPLETED" || event.status === "FAILED") { setNotice(`Sincronización finalizada: ${event.processed ?? 0}/${event.total ?? 0} procesados.`); void refreshProducts(); }
    });
    return () => { socket.disconnect(); };
  }, [session?.accessToken, refreshProducts]);
  const allSelected = products.length > 0 && products.every((p) => selected.includes(p.id));
  const sourceName = useMemo(() => sources.find((s) => s.source.id === sourceId)?.source.name ?? "Tienda propia", [sources, sourceId]);
  async function refreshCatalog() {
    if (sourceId === "ALL") return;
    setBusy(true); setNotice("");
    try { await fetchWithAuth(`/api/tenant/${tenantId}/product-sources/${sourceId}/refresh`, { method: "POST" }, session?.accessToken); setNotice("Actualización encolada correctamente."); void refreshProducts(); void refreshSources(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible actualizar el catálogo."); }
    finally { setBusy(false); }
  }
  async function syncProducts() {
    if (sourceId === "ALL") return;
    setBusy(true); setNotice("");
    try { await fetchWithAuth(`/api/tenant/${tenantId}/sync-batches`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceStoreId: sourceId, productIds: selected }) }, session?.accessToken); setNotice(`Sincronización encolada para ${selected.length ? selected.length : "todos los productos"}.`); setSelected([]); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible sincronizar."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-[1500px] space-y-6 p-6 text-slate-900">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-widest text-[#137fec]">Catálogo</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Productos</h1><p className="mt-1 text-slate-500">Administra y sincroniza los productos de tus tiendas conectadas.</p></div><div className="flex gap-2"><button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold" onClick={refreshCatalog} disabled={busy}>Actualizar catálogo</button><button className="rounded-lg bg-[#137fec] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={syncProducts} disabled={busy || !sourceId}>Sincronizar{selected.length ? ` (${selected.length})` : ""}</button></div></header>
    {notice && <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap gap-3"><select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={sourceId} onChange={(e) => { setSourceId(e.target.value); setPage(1); setSelected([]); }}><option value="ALL">Todas las tiendas</option>{sources.map((item) => <option key={item.source.id} value={item.source.id}>{item.source.name ?? item.source.id} {item.kind === "CONNECTED" ? "· conectada" : "· propia"}</option>)}</select><input className="min-w-[250px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nombre o SKU..." /><select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={`${sortBy}:${order}`} onChange={(e) => { const [key, direction] = e.target.value.split(":"); setSortBy(key); setOrder(direction); }}><option value="createdAt:desc">Más recientes</option><option value="createdAt:asc">Más antiguos</option><option value="title:asc">Nombre A-Z</option><option value="title:desc">Nombre Z-A</option></select></div><div className="mt-5 flex items-center justify-between"><p className="text-sm text-slate-500">Catálogo: <span className="font-semibold text-slate-800">{sourceName}</span></p><p className="text-sm text-slate-500">{productResponse?.total ?? 0} productos</p></div></section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{isLoading ? <div className="p-10 text-center text-slate-500">Cargando productos…</div> : products.length === 0 ? <div className="p-14 text-center"><p className="text-lg font-semibold">No hay productos para mostrar</p><p className="mt-1 text-sm text-slate-500">Actualiza el catálogo o conecta una tienda source.</p></div> : <table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-12 px-4 py-3"><input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? products.map((p) => p.id) : [])} /></th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">SKU / variantes</th><th className="px-4 py-3">Precio</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Actualizado</th></tr></thead><tbody className="divide-y divide-slate-100">{products.map((product) => { const variant = product.variants?.[0]; return <tr key={product.id} className="hover:bg-slate-50"><td className="px-4 py-4"><input type="checkbox" checked={selected.includes(product.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} /></td><td className="px-4 py-4"><div className="font-semibold">{product.title}</div><div className="text-xs text-slate-400">{product.id}</div></td><td className="px-4 py-4">{variant?.sku ?? "—"} <span className="text-slate-400">· {product.variants?.length ?? 0}</span></td><td className="px-4 py-4">{variant?.price ?? "—"}</td><td className="px-4 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{product.status ?? "ACTIVO"}</span></td><td className="px-4 py-4 text-slate-500">{product.updatedAt ? new Date(product.updatedAt).toLocaleDateString("es-CO") : "—"}</td></tr>; })}</tbody></table>}<div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500"><span>Página {page} de {totalPages}</span><div className="flex gap-2"><button className="rounded-md border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button className="rounded-md border px-3 py-1 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></div></div></section>
  </main>;
}
