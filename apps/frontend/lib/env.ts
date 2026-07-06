/**
 * Helper para resolver la URL del backend.
 *
 * Convención única:
 * - `NEXT_PUBLIC_API_URL`: para código que corre en el navegador.
 * - `BACKEND_URL`: solo para código server-side (route handlers, server
 *   actions, lambdas).
 *
 * En el frontend se prefiere `NEXT_PUBLIC_API_URL`. Si no está definida
 * se usa `http://localhost:3001` para desarrollo local.
 */
const DEFAULT_BACKEND_URL = 'http://localhost:3001';

export function getBackendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    DEFAULT_BACKEND_URL
  );
}

export const BACKEND_URL = getBackendUrl();