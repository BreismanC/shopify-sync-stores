# 🏁 Definition of Done — MVP Core

> **Alcance**: Solo las funcionalidades mínimas viables (MVP). Features fuera de esta lista se difieren a versiones posteriores.
>
> **Fuentes**: `wiki/architecture/ANALISIS_SYNCIO.md`, `wiki/specs/REQUERIMIENTOS_GENERALES.md` (RF), `wiki/specs/USER_STORIES.md` (HU), `wiki/architecture/FLUJOS_DE_NEGOCIO.md`.
>
> **Fuera del MVP**: marketplace, multi-location, multi-currency, payouts automáticos, override de atributos por destino, sync manual bajo demanda, reglas personalizadas de sync, multi-supplier order split, audit log avanzado, multi-tenant UI extra.

---

## 1. Propuesta de valor MVP

Una tienda **SOURCE** vende su catálogo a través de una tienda **DESTINATION** conectada por invitación directa. El sistema replica **productos y stock** en tiempo casi-real. Cuando alguien compra en DESTINATION, el pedido se **rutea al SOURCE** para fulfillment y se calcula una **commission** simple.

```
SOURCE ──────▶ DESTINATION ──────▶ Cliente final
   ▲                                    │
   └────── dropship order + tracking ───┘
   └──────────── revenue split ─────────┘
```

---

## 2. Features del MVP

Cada feature incluye solo lo esencial para validar el producto.

### 2.1 Conexión única entre tiendas (sin marketplace)

- [ ] **F-CONN-01** SOURCE invita por email a una DESTINATION.
  - `POST /api/connections/invite` con `{destinationEmail, sourceStoreId}`.
  - Crea `Connection(status=PENDING)`, envía email con link firmado (TTL 24h).
  - Estado actual: módulo `team-invitation` ya implementa este patrón.

- [ ] **F-CONN-02** DESTINATION acepta o rechaza.
  - `POST /api/connections/accept` con `{token}` → estado `ACTIVE`. Genera trial si no tiene subscription.
  - `POST /api/connections/:id/revoke` → estado `REVOKED`.
  - Una SOURCE puede tener N DESTINATION; una DESTINATION solo 1 SOURCE en MVP.

- [ ] **F-CONN-03** Listar y cancelar conexiones.
  - `GET /api/connections?status=ACTIVE`.
  - `DELETE /api/connections/:id` → estado `CANCELED`, detiene sync.

### 2.2 Catálogo compartido (sin override)

- [ ] **F-PROD-01** SOURCE define qué atributos sincroniza.
  - `PUT /api/connections/:id/sync-settings` con `{syncPrice, syncDescription, syncImages}` (los demás quedan en MVP2).
  - Default en MVP: `syncPrice=true, syncDescription=true, syncImages=true`.

- [ ] **F-PROD-02** Importar productos del SOURCE al DESTINATION.
  - `POST /api/connections/:id/import-products` con `{skus: string[]}`.
  - Crea un producto en DESTINATION por cada SKU con `external_product_id` apuntando al SOURCE.
  - Crea `SyncedProduct` link.

### 2.3 Stock en tiempo casi-real

- [ ] **F-STOCK-01** Sync de stock vía webhook de Shopify.
  - Webhook `inventory_levels/update` del SOURCE → actualiza stock en DESTINATION ≤ 10s (RNF-18).
  - Si dos DESTINATION venden a la vez, el SOURCE descuenta acumulado sin oversell.
  - Auto-sync activo por defecto en MVP (sin toggle).

### 2.4 Dropshipping básico (sin split multi-supplier)

- [ ] **F-ORDER-01** Reenvío de pedido al SOURCE.
  - Webhook `orders/create` del DESTINATION → crea `SyncOrder` y `POST` al SOURCE con line items.
  - SOURCE ve la orden con metadata `synced_from`.

- [ ] **F-ORDER-02** Tracking sync.
  - Webhook `fulfillments/update` del SOURCE → copia tracking al pedido original en DESTINATION.

- [ ] **F-ORDER-03** Estados de la orden reflejados.
  - Estados propagados: `placed → paid → fulfilled → shipped → cancelled`.
  - Una orden MVP = un solo SOURCE (sin split).

### 2.5 Commission simple

- [ ] **F-PAY-01** Commission % fija por conexión.
  - `PUT /api/connections/:id` con `{commissionPct: 0-100}`.
  - Al confirmar pago, `Payout(commissionAmount = total * pct / 100, status=PENDING_SETTLEMENT)`.

- [ ] **F-PAY-02** Historial de payouts del SOURCE.
  - `GET /api/payouts?status=PENDING_SETTLEMENT`.
  - En MVP el owner marca como `SETTLED` manualmente (sin integración con pasarela de desembolso).

### 2.6 Onboarding + subscripción trial (ya implementado, ajustar a MVP)

- [ ] **F-ONBOARD-01** Register crea tenant + suscripción trial 7 días.
  - **Existente** y validado. Mantener.

- [ ] **F-ONBOARD-02** Primer tienda Shopify se configura en onboarding.
  - **Existente** (paso 3 del wizard multistep). Mantener.

---

## 3. Modelo de datos mínimo

```
Connection (NUEVO)
  id, sourceStoreId, destinationStoreId,
  status: PENDING | ACTIVE | REVOKED | CANCELED,
  commissionPct (decimal),
  syncSettings (jsonb),
  createdAt, acceptedAt, canceledAt

SyncedProduct (NUEVO)
  id, connectionId,
  sourceShopifyProductId, destinationShopifyProductId,
  sku (unique por connection+sku),
  lastSyncedAt

SyncOrder (NUEVO)
  id, connectionId,
  destinationShopifyOrderId, sourceShopifyOrderId,
  status: RECEIVED | FULFILLING | SHIPPED | CANCELLED,
  totalAmount, currency, commissionAmount,
  trackingNumber (nullable), trackingUrl (nullable),
  createdAt, fulfilledAt

SyncEvent (NUEVO — log mínimo)
  id, connectionId,
  type: PRODUCT_IMPORT | STOCK_UPDATE | ORDER_CREATE | FULFILLMENT_UPDATE,
  status: OK | ERROR,
  errorMessage (nullable),
  createdAt

Payout (NUEVO)
  id, connectionId, syncOrderId,
  amount, currency, commissionAmount,
  status: PENDING_SETTLEMENT | SETTLED,
  settledAt (nullable)
```

Las entidades nuevas siguen el patrón existente (`Store`, `Subscription`, `TeamMember`).

---

## 4. Roadmap MVP

| # | Task | Dependencia |
|---|---|---|
| 1 | `Connection` entity + endpoints CRUD + invitación | — |
| 2 | Webhook handler `inventory_levels/update` | 1 |
| 3 | `SyncedProduct` + import manual de SKUs | 1 |
| 4 | Sync de `product/update` desde SOURCE | 1, 3 |
| 5 | `SyncOrder` + webhook `orders/create` | 1 |
| 6 | Fulfillment sync + tracking | 5 |
| 7 | `Payout` + commission manual | 5 |
| 8 | UI: panel de conexiones, productos, órdenes, payouts | 1-7 |
| 9 | Activity center (lista de SyncEvent) | 8 |

---

## 5. Definition of Done — por feature

Cada feature del §2 se marca ✅ solo si cumple **todo**:

- [ ] Backend: entity en `domain/entities`, DTO con `class-validator` (whitelist + forbidNonWhitelisted), módulo con `Service` + `Controller` + `I…Repository` + TypeORM impl.
- [ ] Backend: `@UseGuards(JwtAuthGuard)` en endpoints autenticados; `@PlanFeature` / `PlanAccessGuard` cuando aplique a límites del plan (RNF-09, RNF-10).
- [ ] Tests: unitarios del service + happy-path e2e. ≥ 80% coverage en código nuevo.
- [ ] Frontend: ruta en `app/(protected)/`, layout con `<SessionProvider>` y `<Toaster>` montados.
- [ ] Frontend: SWR para data fetching; sin tokens en `localStorage`.
- [ ] Validación end-to-end con `pnpm dev`: backend + frontend sin errores de consola ni de tipo.
- [ ] Wiki: flujo documentado en `wiki/features/<feature>.md`.
- [ ] Sin TODO/FIXME nuevos en código merged.
- [ ] Trazabilidad en `wiki/specs/MATRIZ_TRAZABILIDAD.md`.

---

## 6. Fuera del MVP (v2+)

| Feature | Motivo de diferimiento |
|---|---|
| Marketplace de descubrimiento | Distrae del core conexión+sync. |
| Multi-location en DESTINATION | Una sola location cubre el 80% de casos. |
| Multi-currency | Asumimos SOURCE.currency = DESTINATION.currency en MVP. |
| Payouts con integración pasarela (MercadoPago Connect) | Marcado manual en MVP. |
| Override de precio/desc por DESTINATION | SOURCE manda, sin override en MVP. |
| Reglas de sync personalizadas por SKU | Todo-o-nada en MVP por conexión. |
| Split multi-supplier de ordenes | Una orden = un SOURCE en MVP. |
| Audit log por usuario con retención 3 meses | Solo `SyncEvent` operativo en MVP. |
| Subscription upgrade standalone | Trial + Planes solo accesibles vía onboarding en MVP. |
| Onboarding simplificado por tipo de tienda (Source/Dest) | Único flujo en MVP; el rol se elige al crear conexión. |

---

## 7. Riesgos del MVP

- **Webhooks Shopify**: requieren Custom App instalada y verificación de HMAC. Si falla el handshake, no hay sync.
- **OAuth Shopify por tienda**: cada SOURCE/DESTINATION necesita instalar la app. Rate limits de Shopify aplican.
- **Trial de 7 días vs conexión**: si trial expira antes de aceptar la invitación, flujo se rompe. Mitigación: extender trial al aceptar la primera conexión.
- **Single-DESTINATION-per-store en MVP**: si un DESTINATION quiere comprar a 2 SOURCE, debe crear 2 tiendas en el SaaS. Documentar.

---

## 8. Referencias

- `wiki/architecture/ANALISIS_SYNCIO.md` + `ANALISIS_DETALLADO_SYNCIO.md`.
- `wiki/specs/REQUERIMIENTOS_GENERALES.md` (RF).
- `wiki/specs/USER_STORIES.md` (HU).
- `wiki/specs/MATRIZ_TRAZABILIDAD.md`.

---

> **Próxima acción**: abrir un issue por cada feature del §2 con su DoD del §5.
