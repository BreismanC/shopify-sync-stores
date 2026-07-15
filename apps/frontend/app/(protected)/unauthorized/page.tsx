import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Reason =
  | "store-not-found"
  | "tenant-not-found"
  | "team-member-not-invited"
  | "unknown";

const REASON_COPY: Record<
  Reason,
  { title: string; description: string; cta: string; ctaHref: string }
> = {
  "store-not-found": {
    title: "Tu tienda aún no está conectada",
    description:
      "No pudimos encontrar una tienda Shopify vinculada a este espacio de trabajo. Terminá el proceso de configuración para empezar a usar SSS.",
    cta: "Continuar configuración",
    ctaHref: "/onboarding",
  },
  "tenant-not-found": {
    title: "No tenés un espacio activo",
    description:
      "No se encontró un espacio de trabajo asociado a tu cuenta. Si recién te uniste, pedile al dueño que confirme tu invitación.",
    cta: "Ir al login",
    ctaHref: "/auth/login",
  },
  "team-member-not-invited": {
    title: "Esperando que el dueño termine la configuración",
    description:
      "El dueño de este espacio de trabajo todavía no completó la configuración inicial. Apenas termine, vas a poder acceder al dashboard.",
    cta: "Volver al inicio",
    ctaHref: "/auth/login",
  },
  unknown: {
    title: "Acceso no autorizado",
    description:
      "No tenés permisos para acceder a este recurso. Si creés que es un error, contactá al administrador.",
    cta: "Volver al inicio",
    ctaHref: "/auth/login",
  },
};

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const reason: Reason =
    params.reason === "store-not-found" ||
    params.reason === "tenant-not-found" ||
    params.reason === "team-member-not-invited"
      ? (params.reason as Reason)
      : "unknown";
  const copy = REASON_COPY[reason];

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <Card className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-primary">
            <ShieldX className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-on-background">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            {copy.description}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            asChild
            className="h-12 bg-primary px-6 font-semibold text-primary-foreground"
          >
            <Link href={copy.ctaHref}>{copy.cta}</Link>
          </Button>
          <Button
            asChild
            variant="link"
            className="h-12 px-4 text-on-surface-variant"
          >
            <Link href="/auth/login">Iniciar sesión con otra cuenta</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}