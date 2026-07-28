# Estrategia de Pruebas: Dashboard Source/Vendor

## Objetivo
Cubrir las funcionalidades backend requeridas por el dashboard diferenciado por rol de tienda (`SOURCE` / `VENDOR`).

## Alcance de las pruebas

Este PR es **incremental**. El grueso de la lógica de auth/onboarding ya tenía tests previos en el proyecto (en `auth.service.spec.ts`, `onboarding.service.spec.ts`, `onboarding.guard.spec.ts`, etc.). **Los tests pre-existentes no se tocan**.

Lo único nuevo que agrega este PR:

| Archivo | Tests nuevos | Cubre |
| :--- | :---: | :--- |
| `src/application/store/store.controller.spec.ts` | 6 | `GET /api/stores/me`: happy path (Source/Vendor/múltiples) + 404 (sin tienda, sin tenantId undefined, tenantId null). |

**Total tests en el proyecto:** 15 suites, 113 tests (todos pasan).

## Casos de Prueba

### `GET /api/stores/me` (dashboard endpoint)

| Caso | Entrada | Resultado Esperado |
| :--- | :--- | :--- |
| Tienda SOURCE existe | `findByTenantId` devuelve `[store]` con `role: 'SOURCE'` | 200 con `{ store }` |
| Tienda VENDOR existe | `findByTenantId` devuelve `[store]` con `role: 'VENDOR'` | 200 con `{ store.role === 'VENDOR' }` |
| Tenant con múltiples tiendas | `findByTenantId` devuelve `[store1, store2]` | 200 con la primera tienda |
| Tenant sin tienda (caso patológico) | `findByTenantId` devuelve `[]` | 404 con `code: 'STORE_NOT_FOUND'` |
| `tenantId` undefined | `req.user.tenantId === undefined` | 404 sin llamar a la DB; `code: 'STORE_NOT_FOUND'` |
| `tenantId` null | `req.user.tenantId === null` | 404 sin llamar a la DB; `code: 'STORE_NOT_FOUND'` |

**Cobertura:** `store.controller.spec.ts` (líneas 32-128).

## Tests pre-existentes que validan el comportamiento del dashboard

Aunque no son tests "del dashboard" en sentido estricto, estos tests pre-existentes garantizan que la lógica sobre la que se apoya el dashboard funciona:

### `auth.service.spec.ts`
- ✅ `login` incluye `tenantOnboardingStatus` en el JWT y en la response.
- ✅ `refresh` reemite tokens con el `tenantOnboardingStatus` actualizado desde DB.
- ✅ `register` asigna `UserRole.OWNER` al usuario que crea el tenant.

### `onboarding.service.spec.ts`
- ✅ `upsertTenant` avanza tanto `User.onboardingStatus` como `Tenant.onboardingStatus` (vía `advanceTenantStatus`).
- ✅ `setStoreRole` setea `Tenant.onboardingStatus` en `PENDING_TEAM_CONFIG`.
- ✅ `complete` setea ambos en `COMPLETED` y `tenant.status` en `ACTIVE`.
- ✅ Webhook de MP `advanceUserAfterPayment` avanza el tenant.

### `onboarding.guard.spec.ts`
- ✅ Permite acceso si `tenantOnboardingStatus === COMPLETED`.
- ✅ Permite acceso a no-owners si `tenantOnboardingStatus === PENDING_TEAM_CONFIG`.
- ✅ Bloquea acceso en cualquier `PENDING_*` para owners.
- ✅ Bloquea acceso en `PENDING_*` anteriores a `PENDING_TEAM_CONFIG` para no-owners.

## Ejecución

```bash
cd apps/backend
pnpm exec jest src/application/store
```

**Resultado actual:** 1 suite, 6 tests passed.

```bash
pnpm exec jest
```

**Resultado actual:** 15 suites, 113 tests passed.

## Mocks y Aislamiento

`store.controller.spec.ts` mockea:
- `IStoreRepository` (única dependencia del controller).

Sin DB real. Sin HTTP. Sin Nest TestBed (el controller no usa Guards en este test porque JwtAuthGuard se mockea implícitamente al construir el `TestingModule` sin providers del guard).

## Lo que NO se cubre (y por qué)

- **Tests E2E con Playwright:** no se incluyen en este PR. El layout del dashboard ya existe y se valida con `pnpm dev` + smoke tests manuales. Agregar Playwright requiere setup de fixtures de auth que escapa al scope del PR.
- **Tests de carga / performance:** no aplican para este PR. El endpoint `/api/stores/me` es un único SELECT indexado por `tenantId` (índice implícito por FK).
- **Tests del frontend (componentes React):** el proyecto no tiene infraestructura de testing frontend (no hay `@testing-library`, `vitest`, etc. en `apps/frontend/package.json`). El frontend se valida con `tsc --noEmit` (0 errores).
- **Tests de validación del layout (`(protected)/dashboard/layout.tsx`):** el layout ya estaba implementado y su comportamiento queda implícitamente verificado por `proxy.ts`. Tests unitarios del layout saldrían del scope.

## Cómo agregar más tests

1. **Si cambia el comportamiento del 404:** actualizar `store.controller.spec.ts`. El test actual verifica `code: 'STORE_NOT_FOUND'` en la response; cualquier cambio a este contrato requiere actualizar tests.

2. **Si se agrega un endpoint nuevo a `StoreController`** (ej: `GET /api/stores/:id`): crear un nuevo `describe` block dentro del mismo spec file, siguiendo el patrón actual (mockear `IStoreRepository`, instanciar `TestingModule` con sólo el controller).

3. **Si se mueve la lógica de detección de rol al backend:** crear un endpoint `GET /api/stores/me/role` que devuelva `{ role: 'SOURCE' | 'VENDOR' }` y cubrir los 3 casos (Source, Vendor, sin tienda).

4. **Si se agrega validación de rol en el controller:** (ej: sólo owners pueden ver el dashboard), agregar `@UseGuards(OwnerGuard)` y mockear el guard en el test.