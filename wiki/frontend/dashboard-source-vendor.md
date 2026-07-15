# Frontend — Dashboard Source/Vendor

Documento de implementación del frontend para el dashboard diferenciado por rol de tienda.

## 1. Resumen de cambios

Este PR es **incremental**. La mayor parte de la infraestructura de auth/onboarding ya estaba aplicada:

| Pieza | Estado |
| :--- | :--- |
| `auth.ts` con `isOwner` y `tenantOnboardingStatus` | ✅ Ya implementado |
| `proxy.ts` con validación contra `/api/auth/me` | ✅ Ya implementado |
| `(protected)/layout.tsx` (sin chrome) | ✅ Ya implementado |
| `(protected)/dashboard/layout.tsx` (con AppSidebar) | ✅ Ya implementado |
| `AppSidebar` + `useMenuItems` | ✅ Ya implementado |

**Lo único nuevo en este PR:**

| Archivo | Cambio |
| :--- | :--- |
| `apps/frontend/app/(protected)/unauthorized/page.tsx` | **Nuevo.** Server component con mensajes contextuales por `?reason`. |
| `apps/frontend/app/(protected)/dashboard/page.tsx` | **Modificado.** Detecta rol de tienda y renderiza `<DashboardSource>` o `<DashboardVendor>`. |
| `apps/frontend/app/globals.css` | 8 CSS variables nuevas + mappings para Tailwind v4 (`--role-source-*`, `--role-vendor-*`). |
| `apps/frontend/components/source-store/` | **Nuevo.** 9 subcarpetas por entidad con 9 componentes + `data.ts` + `index.tsx`. |
| `apps/frontend/components/vendor-store/` | **Nuevo.** 9 subcarpetas por entidad con 8 componentes + `data.ts` + `index.tsx`. |

---

## 2. Decisión de diseño: usar el route `/dashboard` existente (no `(app)`)

En el proyecto real, el layout `(protected)/dashboard/layout.tsx` ya provee:
- Validación de sesión + `onboardingStatus === COMPLETED` → redirect a `/onboarding` si no.
- Sidebar global vía `<AppSidebar>` (con `useMenuItems`).
- `<SidebarProvider>` + `<SidebarInset>` para el chrome.

Por eso, **no se crea un nuevo grupo de rutas `(app)`**. En su lugar:
1. Se modifica el `dashboard/page.tsx` existente para que detecte el rol y renderice el dashboard correcto.
2. El layout existente provee el chrome.
3. Se agrega `/unauthorized` para el caso 404.

Esto minimiza el diff y respeta la arquitectura existente.

---

## 3. Página `/unauthorized`

`apps/frontend/app/(protected)/unauthorized/page.tsx` (server component).

```typescript
const REASON_COPY: Record<Reason, { title, description, cta, ctaHref }> = {
  'store-not-found': {
    title: 'Tu tienda aún no está conectada',
    description: 'No pudimos encontrar una tienda Shopify vinculada...',
    cta: 'Continuar configuración',
    ctaHref: '/onboarding',
  },
  'tenant-not-found': {
    title: 'No tenés un espacio activo',
    description: '...',
    cta: 'Ir al login',
    ctaHref: '/auth/login',
  },
  unknown: {
    title: 'Acceso no autorizado',
    description: '...',
    cta: 'Volver al inicio',
    ctaHref: '/auth/login',
  },
};
```

Lee `searchParams.reason` y muestra el mensaje + CTA correspondiente.

---

## 4. Página `/dashboard` — Detección de Rol

`apps/frontend/app/(protected)/dashboard/page.tsx` (server component):

```typescript
const res = await fetch(`${BACKEND_URL}/api/stores/me`, {
  headers: { Authorization: `Bearer ${session.accessToken}` },
  cache: "no-store",
});

if (res.status === 404) {
  redirect("/unauthorized?reason=store-not-found");
}
if (!res.ok) {
  redirect("/auth/login");
}

const { store } = await res.json();
return store.role === "VENDOR" ? <DashboardVendor /> : <DashboardSource />;
```

**Decisión:** server-side para evitar parpadeos. El cliente recibe directo el árbol del dashboard correcto.

**Defensa redundante:** el layout `(protected)/dashboard/layout.tsx` ya validó sesión y `onboardingStatus === COMPLETED`. La página sólo verifica que existe tienda.

---

## 5. Componentes del dashboard

### Organización por entidad

```
components/
├── source-store/                      # NEW
│   ├── store/   (StoreBadge, StoreKeyCard)
│   ├── account/ (YourAccountCard)
│   ├── performance/ (PerformanceCard, PerformanceSection)
│   ├── feedback/ (HaveYourSayCard)
│   ├── resources/ (ResourcesCard)
│   ├── plan/ (PlanUsageSidebarCard)
│   ├── navigation/ (SourceSidebarMenu)
│   ├── welcome/ (WelcomeHeader)
│   ├── data.ts (mocks)
│   └── index.tsx (<DashboardSource>)
└── vendor-store/                      # NEW
    ├── store/   (VendorBadge)
    ├── account/ (YourAccountCard)
    ├── feedback/ (HaveYourSayCard)
    ├── news/ (WhatsNewCard)
    ├── resources/ (LearnTheBasicsCard)
    ├── plan/ (LimitsUsageSidebarCard)
    ├── navigation/ (VendorSidebarMenu)
    ├── welcome/ (WelcomeHeader)
    ├── data.ts (mocks)
    └── index.tsx (<DashboardVendor>)
```

### Componentes por dashboard

**Source** (`<DashboardSource>`):
- `<WelcomeHeader />` — bloque "Bienvenido"
- `<PerformanceSection metrics={...} />` — 4 cards de métricas
- `<StoreKeyCard />` — clave única de tienda
- `<YourAccountCard />` — links a configuración
- `<HaveYourSayCard />` — feedback
- `<ResourcesCard />` — Recursos + Learn the basics

**Vendor** (`<DashboardVendor>`):
- `<WelcomeHeader />` — bloque "Bienvenido"
- `<StoreKeyCard />` — clave única de tienda
- `<YourAccountCard />` — links a Configuración + Plan y facturación
- `<HaveYourSayCard />` — feedback
- `<WhatsNewCard />` — feature destacada
- `<LearnTheBasicsCard />` — Learn the basics + help center

### Datos mockeados

En `components/{source,vendor}-store/data.ts`:
```typescript
export const MOCK_STORE = { shopifyShopId, displayName, storeKey, ... };
export const MOCK_PERFORMANCE = [...] as PerformanceMetric[];
export const MOCK_PLAN_USAGE = { ... };
export const SOURCE_SIDEBAR_ITEMS = [...];  // 7 items
export const VENDOR_SIDEBAR_ITEMS = [...];  // 9 items
export const MOCK_RESOURCES = [...];
export const MOCK_LEARN_BASICS = [...];
export const MOCK_ACCOUNT_LINKS = [...];
export const MOCK_FEEDBACK_LINKS = [...];
```

---

## 6. Extensión del Design System

`apps/frontend/app/globals.css` agrega 8 CSS variables + 8 mappings para Tailwind v4:

```css
:root {
  --role-source: #005bd3;
  --role-source-contrast: #ffffff;
  --role-source-surface: #d3deff;
  --role-source-border: #7396ff;

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

Utilities resultantes:
- `bg-role-source`, `text-role-source-contrast`
- `bg-role-vendor`, `text-role-vendor-contrast`
- `bg-role-source-surface`, `bg-role-vendor-surface`
- `border-role-source-border`, `border-role-vendor-border`

**Restricción del usuario:** no se usan colores rojos ni naranjas para diferenciar roles. Source usa azul (`accent-*`). Vendor usa verde (`success-*`).

---

## 7. Server vs Client Components

Sólo son `"use client"` los componentes que requieren hooks del browser:

| Componente | Tipo | Por qué |
| :--- | :--- | :--- |
| `StoreKeyCard` | Client | `navigator.clipboard.writeText` + `toast` |
| `SourceSidebarMenu`, `VendorSidebarMenu` | Client | `usePathname` (referencia futura, no usados hoy) |

Todos los demás son **Server Components** (composición pura + `<Link>`).

---

## 8. Compatibilidad con el sidebar existente

El `<AppSidebar>` global (en `(protected)/dashboard/layout.tsx`) usa `useMenuItems(profile)` para armar el menú dinámicamente. Por eso:

- Los `<SourceSidebarMenu />` y `<VendorSidebarMenu />` que agregamos en `components/{source,vendor}-store/navigation/` son **referencia futura**: sirven cuando el sidebar sea específico por rol, o para tests visuales aislados. **No se usan en producción**.
- El `<PlanUsageSidebarCard />` y `<LimitsUsageSidebarCard />` también son referencia futura: el footer del sidebar actual usa otra estructura (con avatar + dropdown de usuario).

---

## 9. Variables de entorno

No se agregaron variables nuevas. Se usan las existentes:
- `BACKEND_URL` (de `lib/env.ts`) para el fetch server-side desde el dashboard.

---

## 10. Archivos tocados

```
apps/frontend/
├── app/(protected)/
│   ├── dashboard/page.tsx               ✏️ reemplaza placeholder por Source/Vendor switch
│   └── unauthorized/page.tsx            🆕
├── app/globals.css                      ✏️ +34 líneas (CSS variables)
└── components/
    ├── source-store/                    🆕
    │   ├── store/{StoreBadge,StoreKeyCard}.tsx
    │   ├── account/YourAccountCard.tsx
    │   ├── performance/{PerformanceCard,PerformanceSection}.tsx
    │   ├── feedback/HaveYourSayCard.tsx
    │   ├── resources/ResourcesCard.tsx
    │   ├── plan/PlanUsageSidebarCard.tsx
    │   ├── navigation/SourceSidebarMenu.tsx
    │   ├── welcome/WelcomeHeader.tsx
    │   ├── data.ts
    │   └── index.tsx
    └── vendor-store/                    🆕
        ├── store/VendorBadge.tsx
        ├── account/YourAccountCard.tsx
        ├── feedback/HaveYourSayCard.tsx
        ├── news/WhatsNewCard.tsx
        ├── resources/LearnTheBasicsCard.tsx
        ├── plan/LimitsUsageSidebarCard.tsx
        ├── navigation/VendorSidebarMenu.tsx
        ├── welcome/WelcomeHeader.tsx
        ├── data.ts
        └── index.tsx
```