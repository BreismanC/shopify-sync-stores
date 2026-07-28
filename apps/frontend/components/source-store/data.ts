/**
 * Datos mockeados del dashboard para una tienda SOURCE.
 * No hay integración con la API: todos los valores son constantes para
 * poder iterar el diseño sin depender del backend.
 */

export const MOCK_STORE = {
  shopifyShopId: "claudia-almada.myshopify.com",
  displayName: "claudia-almada",
  storeKey: "66cfded85e928",
  oppositeRoleLabel: "Destination",
  oppositeRoleHref: "/dashboard/settings/enable-destination",
};

export interface PerformanceMetric {
  label: string;
  value: number;
  sublabel: string;
}

export const MOCK_PERFORMANCE: PerformanceMetric[] = [
  { label: "Tiendas conectadas", value: 2, sublabel: "Hasta hoy" },
  {
    label: "Productos sincronizados",
    value: 9,
    sublabel: "Hasta hoy",
  },
  {
    label: "Órdenes con productos sincronizados",
    value: 9,
    sublabel: "Últimos 30 días",
  },
  {
    label: "Productos sincronizados vendidos",
    value: 15,
    sublabel: "Últimos 30 días",
  },
];

export const MOCK_RESOURCES: Array<{ label: string; href: string }> = [
  { label: "Guía de inicio rápido", href: "/dashboard/help/quick-start" },
  { label: "Conectar una tienda", href: "/dashboard/help/connect-store" },
  { label: "Sincronizar productos", href: "/dashboard/help/sync-products" },
  {
    label: "Buenas prácticas y sincronización saludable",
    href: "/dashboard/help/best-practices",
  },
];

export const MOCK_ACCOUNT_LINKS: Array<{ label: string; href: string }> = [
  { label: "Configuración de la cuenta", href: "/dashboard/profile" },
];

export const MOCK_FEEDBACK_LINKS: Array<{
  label: string;
  description: string;
  href: string;
}> = [
  {
    label: "Solicitudes de funciones",
    description: "¿Tenés una idea? Enviala y la evaluamos.",
    href: "/dashboard/help/features",
  },
  {
    label: "Contanos qué pensás",
    description: "Encuesta de 3 minutos para ayudarnos a mejorar SSS.",
    href: "/dashboard/help/survey",
  },
];
