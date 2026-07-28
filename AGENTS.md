# AGENTS.md — shopify-sync-stores

Monorepo para sincronización de datos de Shopify con almacenamiento local/externo.
Gestionado con **Turborepo** + **pnpm**. Node ≥ 22 (ver `.nvmrc`).

## Estructura

```
apps/
  frontend/    Next.js 16 (App Router, React 19, Tailwind v4)
  backend/     NestJS 11 (Clean Architecture: domain/application/infrastructure)
  functions/   AWS Lambda (TypeScript)
packages/
  config/          Env vars compartidas (zod)
  database/        TypeORM + Postgres
  eslint-config/   base, next, react-internal
  transactional/   React Email templates
  typescript-config/  base, nextjs, react-library
  ui/              Componentes compartidos
wiki/              Documentación canónica (puente de contexto)
infra/sam/         AWS SAM templates
```

## Comandos (raíz)

- `pnpm dev` — turbo run dev (inicia todas las apps)
- `pnpm build` — turbo run build
- `pnpm lint` — turbo run lint
- `pnpm check-types` — turbo run check-types
- `pnpm format` — prettier --write "**/*.{ts,tsx,md}"

## Reglas de oro

1. **Lee antes de escribir.** Revisa `wiki/` (especialmente `specs/` y `architecture/`) y los `README.md` de cada app/paquete antes de implementar.
2. **Respeta la arquitectura existente.**
   - Backend: Clean Architecture (`apps/backend/src/{domain,application,infrastructure}`). Las dependencias apuntan hacia adentro.
   - Frontend: App Router de Next.js 16. **Lee `node_modules/next/dist/docs/` antes de usar APIs de Next** — esta versión tiene breaking changes.
3. **Configuraciones compartidas:** importa desde los packages (`@repo/eslint-config`, `@repo/typescript-config`, `@shopify-sync/config`, `@shopify-sync/database`). No dupliques configs.
4. **No commitees secretos.** `.env*` está en `.gitignore`. Usa `.env.example` como plantilla.

## Sub-contextos

- `apps/frontend/AGENTS.md` — reglas específicas de Next.js 16 y diseño (`DESIGN.md`).
- `apps/backend/` — NestJS + Clean Architecture + skills locales (`skills/`).
- `apps/functions/` — handlers Lambda, sin servidor HTTP.

## Skills activas

- Frontend: `next-best-practices`, `next-cache-components`, `next-upgrade`, `react-best-practices`, `composition-patterns`, `frontend-design`, `accessibility`, `seo`, `shadcn`, `tailwind-css-patterns`, `tailwind-v4-shadcn`, `nodejs-best-practices`, `nodejs-backend-patterns`, `typescript-advanced-types` (ver `apps/frontend/skills-lock.json`).
- Backend: `clean-architecture`, `nestjs-best-practices`, `typescript-advanced-types` (ver `apps/backend/skills/` y `skills-lock.json`).