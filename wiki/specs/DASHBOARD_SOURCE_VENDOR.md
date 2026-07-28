# Especificación: Dashboard Source/Vendor

## 1. Overview

### Objetivo
Implementar el dashboard principal de la aplicación SSS (Shopify Sync Stores), diferenciado según el rol de la tienda (`SOURCE` / `VENDOR`) seleccionado durante el onboarding. El dashboard ofrece una vista general del estado del workspace con métricas mockeadas, accesos rápidos a las funcionalidades y un diseño coherente con el design system.

### Alcance
- Nueva página `/unauthorized` para errores 4xx (404 store, 404 tenant).
- Página `/dashboard` que detecta el rol de la tienda y renderiza un dashboard distinto según `store.role`.
- Endpoint backend nuevo `GET /api/stores/me` que devuelve **404** si no hay tienda activa.
- Componentes de dashboard organizados por entidad en `components/source-store/` y `components/vendor-store/`.

### Fuera de alcance
- Integración real con la API de métricas (todo es mock en `data.ts`).
- Modificación del layout `(protected)/dashboard/layout.tsx` existente (mantiene su validación con `<AppSidebar>` global).
- Modificación de `auth.ts`, `proxy.ts`, `OnboardingGuard`, etc. — la migración de `User.onboardingStatus → Tenant.onboardingStatus` ya está aplicada en el proyecto real.

### Estado previo del proyecto (lo que ya estaba hecho)
A diferencia del proyecto de prueba donde se aplicó esta spec, **el proyecto real ya tiene aplicadas varias decisiones** que la spec original asumía como cambios:

| Pieza | Estado en el proyecto real |
| :--- | :--- |
| `Tenant.onboardingStatus` column | ✅ Ya existe (migración `1783398456209-MoveOnboardingStatusToTenant`) |
| `User.onboardingStatus` removido | ✅ Removido de la entity |
| `auth.service.register()` asigna OWNER | ✅ Implementado |
| `JwtStrategy` lee `tenant.onboardingStatus` | ✅ Implementado |
| `GET /api/auth/me` endpoint | ✅ Implementado |
| `OnboardingGuard` con `isOwner` | ✅ Implementado |
| `proxy.ts` con validación `/api/auth/me` | ✅ Implementado |
| `auth.ts` con `isOwner` en session.user | ✅ Implementado |

Esta spec documenta únicamente los **cambios incrementales** necesarios.

---

## 2. Roles de Tienda

| Rol | Significado | Tinte del sidebar activo (futuro) |
| :--- | :--- | :--- |
| `SOURCE` | Tienda proveedora de productos | `--role-source-surface` (azul claro) |
| `VENDOR` | Tienda destino de productos | `--role-vendor-surface` (verde claro) |

**Restricción del design system:** el usuario pidió mantener las mismas tonalidades del design system actual, sin usar colores rojos ni naranjas para diferenciar roles. Por eso:
- Source usa la familia azul del design system (`#005bd3` = `accent-9`).
- Vendor usa la familia verde del design system (`#045d3c` = `success-contrast`).

---

## 3. Estructura de Archivos

```
apps/
├── backend/src/application/store/
│   ├── store.controller.ts            🆕 GET /api/stores/me (404)
│   ├── store.controller.spec.ts       🆕 tests
│   └── store.module.ts                ✏️ registra StoreController
└── frontend/
    ├── app/(protected)/
    │   ├── dashboard/page.tsx         ✏️ detecta rol, renderiza Source/Vendor
    │   └── unauthorized/page.tsx      🆕 server component con mensajes contextuales
    ├── app/globals.css                ✏️ 8 CSS variables + @theme inline
    └── components/
        ├── source-store/              🆕 subcarpetas por entidad
        │   ├── store/   (StoreBadge, StoreKeyCard)
        │   ├── account/ (YourAccountCard)
        │   ├── performance/ (PerformanceCard, PerformanceSection)
        │   ├── feedback/ (HaveYourSayCard)
        │   ├── resources/ (ResourcesCard)
        │   ├── plan/ (PlanUsageSidebarCard)
        │   ├── navigation/ (SourceSidebarMenu — referencia futura)
        │   ├── welcome/ (WelcomeHeader)
        │   ├── data.ts (mocks)
        │   └── index.tsx (<DashboardSource>)
        └── vendor-store/              🆕 subcarpetas por entidad
            ├── store/ (VendorBadge)
            ├── account/ (YourAccountCard)
            ├── feedback/ (HaveYourSayCard)
            ├── news/ (WhatsNewCard)
            ├── resources/ (LearnTheBasicsCard)
            ├── plan/ (LimitsUsageSidebarCard)
            ├── navigation/ (VendorSidebarMenu — referencia futura)
            ├── welcome/ (WelcomeHeader)
            ├── data.ts (mocks)
            └── index.tsx (<DashboardVendor>)
```

**Subcarpetas por entidad:** cada subcarpeta agrupa componentes que pertenecen a la misma entidad funcional (store, account, plan, etc.).

---

## 4. Endpoint Nuevo del Backend

### `GET /api/stores/me`

Usado por la página `/dashboard` para detectar la tienda actual y su rol. **Diferencia con `GET /api/onboarding/store/status`:**

| Endpoint | Status cuando NO hay tienda | Uso |
| :--- | :--- | :--- |
| `GET /api/onboarding/store/status` | 200 con `{ store: null }` | Durante el onboarding (Step3Store, Step4Role, OnboardingSummary) |
| `GET /api/stores/me` | **404** con `{ code: "STORE_NOT_FOUND" }` | En rutas post-onboarding (dashboard, products, etc.) |

**Respuesta 200:**
```json
{
  "store": {
    "id": "uuid",
    "shopifyShopId": "mi-tienda.myshopify.com",
    "role": "SOURCE",
    "isActive": true,
    "tenantId": "uuid",
    "accessToken": "encrypted-...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Respuesta 404:**
```json
{ "code": "STORE_NOT_FOUND", "message": "El tenant no tiene una tienda conectada." }
```

**Auth:** `JwtAuthGuard`. Se valida `req.user.tenantId`.

---

## 5. Página `/unauthorized` (Server Component)

Lee `searchParams.reason` y muestra uno de tres mensajes contextuales:

| Reason | Mensaje | CTA principal |
| :--- | :--- | :--- |
| `store-not-found` | "Tu tienda aún no está conectada" | Continuar configuración → `/onboarding` |
| `tenant-not-found` | "No tenés un espacio activo" | Ir al login → `/auth/login` |
| _default_ | "Acceso no autorizado" | Volver al inicio → `/auth/login` |

Ubicada en `app/(protected)/unauthorized/page.tsx`. Hereda la validación de sesión del layout `(protected)/layout.tsx` (sin sesión → redirect a `/auth/login`).

---

## 6. Página `/dashboard` — Detección de Rol

`app/(protected)/dashboard/page.tsx` (server component):

```typescript
const res = await fetch(`${BACKEND_URL}/api/stores/me`, {
  headers: { Authorization: `Bearer ${session.accessToken}` },
  cache: "no-store",
});

if (res.status === 404) redirect("/unauthorized?reason=store-not-found");
if (!res.ok) redirect("/auth/login");

const { store } = await res.json();
return store.role === "VENDOR" ? <DashboardVendor /> : <DashboardSource />;
```

**Decisión:** server-side para evitar parpadeos. El cliente recibe directo el árbol del dashboard correcto.

---

## 7. Componentes de Dashboard

### Dashboard Source — `components/source-store/index.tsx`

Server component que compone:

| Sección | Componente | Datos mock |
| :--- | :--- | :--- |
| Header | `WelcomeHeader` | título + subtítulo |
| Performance | `PerformanceSection` + 4× `PerformanceCard` | 2 / 9 / 9 / 15 |
| Essentials | `StoreKeyCard` + `YourAccountCard` | `66cfded85e928` |
| Feedback | `HaveYourSayCard` | 2 links |
| Resources | `ResourcesCard` | 4 links |

### Dashboard Vendor — `components/vendor-store/index.tsx`

Server component que compone:

| Sección | Componente | Datos mock |
| :--- | :--- | :--- |
| Header | `WelcomeHeader` | título + subtítulo |
| Essentials | `StoreKeyCard` + `YourAccountCard` | `66abcec97c5e4` (2 links) |
| Feedback | `HaveYourSayCard` | 2 links |
| What's New | `WhatsNewCard` | "Sincronizá stock a múltiples ubicaciones" |
| Learn the basics | `LearnTheBasicsCard` | 4 links |

---

## 8. Extensión del Design System

Se agregaron las siguientes CSS variables en `apps/frontend/app/globals.css`:

```css
:root {
  /* Source — azul (familia accent-*) */
  --role-source: #005bd3;
  --role-source-contrast: #ffffff;
  --role-source-surface: #d3deff;
  --role-source-border: #7396ff;

  /* Vendor — verde (basado en success-*) */
  --role-vendor: #045d3c;
  --role-vendor-contrast: #ffffff;
  --role-vendor-surface: #c6f0e2;
  --role-vendor-border: #5fb892;
}

@theme inline {
  --color-role-source: var(--role-source);
  --color-role-source-contrast: var(--role-source-contrast);
  --color-role-source-surface: var(--role-source-surface);
  --color-role-source-border: var(--role-source-border);
  --color-role-vendor: var(--role-vendor);
  --color-role-vendor-contrast: var(--role-vendor-contrast);
  --color-role-vendor-surface: var(--role-vendor-surface);
  --color-role-vendor-border: var(--role-vendor-border);
}
```

Utilities resultantes: `bg-role-source`, `text-role-vendor`, `bg-role-vendor-surface`, etc.

---

## 9. Server vs Client Components

Sólo son `"use client"` los componentes que requieren hooks del browser:

| Componente | Tipo | Por qué |
| :--- | :--- | :--- |
| `StoreKeyCard` | Client | `navigator.clipboard.writeText` + `toast` |
| `SourceSidebarMenu`, `VendorSidebarMenu` | Client | `usePathname` (referencia futura, no usados hoy) |

Todos los demás son **Server Components** (composición pura + `<Link>`).

---

## 10. Criterios de Aceptación (Definition of Done)

- [x] `GET /api/stores/me` retorna 200 + tienda si existe.
- [x] `GET /api/stores/me` retorna 404 con `code: STORE_NOT_FOUND` si no hay tienda.
- [x] `GET /api/stores/me` retorna 404 con `code: STORE_NOT_FOUND` si `tenantId` es null/undefined.
- [x] Página `/dashboard` renderiza `<DashboardSource>` para `role === 'SOURCE'`.
- [x] Página `/dashboard` renderiza `<DashboardVendor>` para `role === 'VENDOR'`.
- [x] Página `/dashboard` redirige a `/unauthorized?reason=store-not-found` cuando 404.
- [x] Página `/unauthorized` muestra mensaje contextual según `?reason`.
- [x] Source dashboard contiene: Welcome, Performance (4 cards), The essentials (clave + tu cuenta), Recursos (4 links), Have your say (2 links).
- [x] Vendor dashboard contiene: Welcome, The essentials (clave + 2 links tu cuenta), What's New (multi-location + Learn more), Learn the basics (4 links), Have your say (2 links).
- [x] Colores vienen de CSS variables (`--role-source-*`, `--role-vendor-*`), sin hardcode.
- [x] `pnpm tsc --noEmit` (frontend y backend) no reporta errores introducidos por esta spec.
- [x] Backend `jest` pasa: 15 suites, 113 tests (incluye los 6 nuevos de `store.controller.spec.ts`).