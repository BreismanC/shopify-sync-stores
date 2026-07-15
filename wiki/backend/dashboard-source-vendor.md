# Backend — Dashboard Source/Vendor

Documento de implementación del backend para soportar el dashboard diferenciado por rol de tienda.

## 1. Resumen de cambios

Este PR es **incremental**. La mayor parte de la infraestructura necesaria ya estaba aplicada en el proyecto real:

| Pieza | Estado |
| :--- | :--- |
| `Tenant.onboardingStatus` column | ✅ Ya existía |
| `User.onboardingStatus` removido | ✅ Ya removido |
| `auth.service.register()` → OWNER | ✅ Ya implementado |
| `JwtStrategy` lee tenant.onboardingStatus | ✅ Ya implementado |
| `OnboardingGuard` con `isOwner` | ✅ Ya implementado |
| `proxy.ts` con validación `/api/auth/me` | ✅ Ya implementado |
| `GET /api/auth/me` endpoint | ✅ Ya implementado |

**Lo único nuevo que se agrega en este PR:**

| Archivo | Cambio |
| :--- | :--- |
| `apps/backend/src/application/store/store.controller.ts` | **Nuevo.** `GET /api/stores/me` con 404 si no hay tienda. |
| `apps/backend/src/application/store/store.controller.spec.ts` | **Nuevo.** 6 tests cubriendo happy path y 404. |
| `apps/backend/src/application/store/store.module.ts` | Registra el `StoreController` en `controllers: []`. |

---

## 2. Endpoint nuevo: `GET /api/stores/me`

### Ubicación
`apps/backend/src/application/store/store.controller.ts`

### Código
```typescript
@Controller('stores')
@UseGuards(JwtAuthGuard)
export class StoreController {
  constructor(
    @Inject(IStoreRepository)
    private readonly storeRepository: IStoreRepository,
  ) {}

  @Get('me')
  async getMyStore(@Req() req: RequestWithUser) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'No hay un tenant activo asociado al usuario.',
      });
    }

    const stores = await this.storeRepository.findByTenantId(tenantId);
    const store = stores[0];
    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'El tenant no tiene una tienda conectada.',
      });
    }

    return { store };
  }
}
```

### Respuestas

**200 OK** — tienda encontrada:
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

**404 Not Found** — sin tienda o sin tenantId:
```json
{ "code": "STORE_NOT_FOUND", "message": "El tenant no tiene una tienda conectada." }
```

### Diferencia con `GET /api/onboarding/store/status`

| Endpoint | Status sin tienda | Uso |
| :--- | :--- | :--- |
| `GET /api/onboarding/store/status` | 200 con `{ store: null }` | Onboarding (Step3Store, Step4Role, OnboardingSummary) |
| `GET /api/stores/me` | **404** con `code: STORE_NOT_FOUND` | Post-onboarding (dashboard, products, etc.) |

El 404 permite al frontend detectar la ausencia de tienda **sin ambigüedad** y redirigir a `/unauthorized?reason=store-not-found`.

---

## 3. Registro del controller

`apps/backend/src/application/store/store.module.ts`:

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Store])],
  controllers: [StoreController],  // ← nuevo
  providers: [
    {
      provide: IStoreRepository,
      useClass: TypeORMStoreRepository,
    },
  ],
  exports: [IStoreRepository],
})
export class StoreModule {}
```

El módulo ya estaba importado en `AppModule` (ver `app.module.ts`).

---

## 4. Tests del endpoint

`apps/backend/src/application/store/store.controller.spec.ts` cubre:

| Caso | Resultado |
| :--- | :--- |
| Tienda SOURCE existe | 200 con `{ store }` |
| Tienda VENDOR existe | 200 con `{ store }` |
| Tenant tiene múltiples tiendas | 200 con la primera |
| Tenant sin tienda (array vacío) | 404 con `code: STORE_NOT_FOUND` |
| `tenantId` undefined | 404 sin llamar a la DB |
| `tenantId` null | 404 sin llamar a la DB |

```bash
$ cd apps/backend
$ pnpm exec jest src/application/store
Tests:       6 passed, 6 total
```

Suite completa: `pnpm exec jest` → **15 suites, 113 tests, todos pasan**.

---

## 5. Variables de entorno

No se agregaron variables nuevas. El endpoint usa las mismas que ya estaban configuradas (`AUTH_SECRET` desde el backend, `BACKEND_URL` desde el frontend).

---

## 6. Archivos tocados

```
apps/backend/src/application/store/
├── store.controller.ts                🆕 47 líneas
├── store.controller.spec.ts           🆕 132 líneas
└── store.module.ts                    ✏️ +2 líneas (import + controllers: [...])
```