export function tenantPath(tenantId: string, path = "/dashboard"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const appPath = normalized.startsWith("/dashboard/")
    ? normalized.slice("/dashboard".length)
    : normalized === "/dashboard"
      ? "/dashboard"
      : normalized;
  return `/tenant/${tenantId}${appPath}`;
}

export function tenantIdFromPathname(pathname: string): string | null {
  return pathname.match(/^\/tenant\/([^/]+)/)?.[1] ?? null;
}
