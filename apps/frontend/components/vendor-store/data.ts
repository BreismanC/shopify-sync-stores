/**
 * Datos mockeados del dashboard para una tienda VENDOR.
 * No hay integración con la API: todos los valores son constantes para
 * poder iterar el diseño sin depender del backend.
 */

export const MOCK_STORE = {
  shopifyShopId: "isaac-alvizo.myshopify.com",
  displayName: "isaac's Test Store",
  storeKey: "66abcec97c5e4",
  oppositeRoleLabel: "Source",
};

export const MOCK_LEARN_BASICS: Array<{ label: string; href: string }> = [
  { label: "Guía de inicio rápido", href: "/dashboard/help/quick-start" },
  { label: "Conectar una tienda", href: "/dashboard/help/connect-store" },
  { label: "Sincronizar productos", href: "/dashboard/help/sync-products" },
  {
    label: "Buenas prácticas y sincronización saludable",
    href: "/dashboard/help/best-practices",
  },
];

export const MOCK_ACCOUNT_LINKS: Array<{
  label: string;
  href: string;
  description?: string;
}> = [
  {
    label: "Configuración de la cuenta",
    description: "Administrá los ajustes de tu cuenta y notificaciones.",
    href: "/dashboard/profile",
  },
  {
    label: "Plan y facturación",
    description: "Administrá los detalles de tu plan y facturación.",
    href: "/dashboard/billing",
  },
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
