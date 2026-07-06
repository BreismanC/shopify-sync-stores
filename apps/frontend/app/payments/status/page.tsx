import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { PaymentStatusClient } from "@/components/payments/PaymentStatusClient";

/**
 * /payments/status — landing page pública.
 *
 * Es pública a propósito: MercadoPago redirige cross-site a esta URL
 * después del pago, y en esa navegación el navegador puede no
 * reenviar las cookies de sesión de NextAuth. Si estuviera dentro de
 * `(protected)`, el layout haría `auth()` y, sin sesión, mandaría al
 * login — rompiendo el flujo.
 *
 * La autorización real la hace el endpoint público del backend
 * (`GET /api/onboarding/public/preapproval-status`) que valida un
 * token firmado con TTL corto.
 */
export default function PaymentStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <PaymentStatusClient />
    </Suspense>
  );
}