import { redirect } from 'next/navigation';

/**
 * La pantalla de pedidos vive ahora en `/orders` (top-level).
 * Esta ruta legacy dentro del dashboard simplemente redirige.
 */
export default function DashboardOrdersRedirect(): never {
  redirect('/orders');
}