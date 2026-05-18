# 🏗️ Estructura General del Proyecto: shopify-sync-stored

## 🎯 Objetivo
Sincronización de datos de Shopify con un almacenamiento local/externo (Stored).

## 📂 Arquitectura del Monorepo (Turborepo)
El proyecto utiliza un enfoque de monorepo gestionado por **Turborepo** y **pnpm**, permitiendo compartir configuraciones y dependencias entre el frontend y el backend.

### 📁 Estructura de Carpetas
- `apps/`: Contiene las aplicaciones desplegables.
  - `frontend/`: Aplicación de interfaz de usuario construida con **Next.js**.
  - `backend/`: API y lógica de negocio construida con **NestJS**.
- `packages/`: Configuraciones compartidas (ESLint, TypeScript, UI components).
- `wiki/`: Documentación centralizada (Puente de contexto para agentes y humanos).
  - `/specs`: Especificaciones técnicas y requerimientos.
  - `/architecture`: Decisiones de diseño y diagramas.
  - `/logs`: Bitácora de cambios y decisiones diarias.

## 🛠️ Stack Tecnológico
- **Gestor de Paquetes:** `pnpm`
- **Orquestador:** `Turbo`
- **Frontend:** `Next.js` + `Tailwind CSS` + `TypeScript`
- **Backend:** `NestJS` + `TypeScript`
- **Documentación:** `Obsidian` (Markdown)

## 🚀 Comandos Principales
- `pnpm run dev`: Inicia todas las aplicaciones en modo desarrollo.
- `pnpm run build`: Construye todas las aplicaciones.
- `pnpm run lint`: Ejecuta el linter en todo el proyecto.
