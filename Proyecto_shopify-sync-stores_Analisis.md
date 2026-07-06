# Análisis del Proyecto `shopify-sync-stores`

## Arquitectura General

El proyecto `shopify-sync-stores` es un monorepo gestionado por [Turborepo](https://turborepo.dev/). Esta arquitectura permite la gestión eficiente de múltiples aplicaciones y paquetes de código dentro de un solo repositorio, optimizando los tiempos de construcción y desarrollo al cachear artefactos.

## Componentes Principales

El monorepo está estructurado en las siguientes aplicaciones y paquetes:

### Aplicaciones (Apps)

-   `docs`: Una aplicación desarrollada con [Next.js](https://nextjs.org/). Generalmente utilizada para documentación, blogs o sitios estáticos.
-   `web`: Otra aplicación desarrollada con [Next.js](https://nextjs.org/). Es probable que sea la interfaz principal de usuario o una aplicación web para funcionalidades específicas.

### Paquetes Compartidos (Packages)

-   `@repo/ui`: Una librería de componentes [React](https://react.dev/) que se comparte entre las aplicaciones `web` y `docs`. Esto promueve la reutilización de código y mantiene la consistencia visual.
-   `@repo/eslint-config`: Configuraciones de [ESLint](https://eslint.org/) utilizadas en todo el monorepo. Incluye `eslint-config-next` y `eslint-config-prettier` para mantener un estilo de código consistente y libre de errores.
-   `@repo/typescript-config`: Configuraciones de [TypeScript](https://www.typescriptlang.org/) (`tsconfig.json`) que se aplican a través de todo el monorepo para garantizar la coherencia en la tipificación.

## Flujo de Datos y Funcionamiento General

El proyecto se basa en un ecosistema de desarrollo moderno:

1.  **Desarrollo:** Los desarrolladores trabajan en las aplicaciones y paquetes utilizando [TypeScript](https://www.typescriptlang.org/) para asegurar la robustez del código.
2.  **Linting y Formato:** [ESLint](https://eslint.org/) y [Prettier](https://prettier.io) se encargan de mantener la calidad y el formato del código, respectivamente, aplicando reglas definidas en los paquetes `@repo/eslint-config` y `prettier`.
3.  **Gestión de Dependencias:** [pnpm](https://pnpm.io/) es el gestor de paquetes utilizado, conocido por su eficiencia en el uso del espacio en disco y la velocidad de instalación en monorepos.
4.  **Compilación y Desarrollo:** [Turborepo](https://turborepo.dev/) orquesta las tareas de `build` y `dev` para todas las aplicaciones y paquetes. Esto significa que los comandos como `turbo build` o `turbo dev` pueden ejecutar las tareas de construcción o desarrollo de todos los proyectos o de proyectos específicos mediante filtros.
5.  **Caché Remoto:** El proyecto soporta [Vercel Remote Cache](https://turborepo.dev/docs/core-concepts/remote-caching), lo que permite compartir artefactos de caché entre diferentes máquinas y pipelines de CI/CD. Esto acelera significativamente los tiempos de construcción en entornos de equipo y despliegue continuo.

### Scripts Principales (definidos en `package.json`)

-   `build`: Compila todas las aplicaciones y paquetes (`turbo run build`).
-   `dev`: Inicia los servidores de desarrollo para todas las aplicaciones y paquetes (`turbo run dev`).
-   `lint`: Ejecuta el linter en todos los proyectos (`turbo run lint`).
-   `format`: Formatea el código con Prettier (`prettier --write "**/*.{ts,tsx,md}"`).
-   `check-types`: Realiza la verificación de tipos en todos los proyectos (`turbo run check-types`).

## Tecnologías Utilizadas

-   **Monorepo Tool:** Turborepo
-   **Gestor de Paquetes:** pnpm
-   **Frameworks Web:** Next.js, React
-   **Lenguaje:** TypeScript
-   **Herramientas de Calidad de Código:** ESLint, Prettier
-   **Versión de Node.js:** >=22
