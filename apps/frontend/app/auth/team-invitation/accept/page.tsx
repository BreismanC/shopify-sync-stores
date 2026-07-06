"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Form, FormField, FormSubmit } from "@/components/ui/Form";
import { useFormDynamic } from "@/hooks/use-dynamic-form";
import { apiFetch } from "@/lib/auth";
import { BACKEND_URL } from "@/lib/env";

interface InvitationPreview {
  valid: boolean;
  reason?: string;
  invitation?: {
    email: string;
    name: string;
    role: string;
    expiresAt: string;
  };
}

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { field, getValues, setFetchStatus, fetchStatus } = useFormDynamic({
    password: "text",
  });

  useEffect(() => {
    if (!token) {
      setPreview({ valid: false, reason: "no_token" });
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<InvitationPreview>(
          `${BACKEND_URL}/api/auth/team-invitation/${token}`,
          { method: "GET" },
        );
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) {
          setPreview({ valid: false, reason: "not_found" });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const { password } = getValues() as { password: string };
    if (!password || password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setFetchStatus("loading");
    try {
      await apiFetch<{ user: { id: string; email: string }; tenantId: string }>(
        `${BACKEND_URL}/api/auth/team-invitation/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        },
      );
      toast.success("¡Invitación aceptada! Iniciá sesión.");
      router.push("/auth/login");
    } catch (err: any) {
      toast.error(err.message || "Error al aceptar la invitación");
      setFetchStatus("error");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!preview?.valid) {
    const reason = preview?.reason ?? "unknown";
    const messages: Record<string, string> = {
      not_found: "Esta invitación no existe o ya no es válida.",
      already_accepted: "Esta invitación ya fue aceptada.",
      revoked: "Esta invitación fue revocada por el owner.",
      expired: "Esta invitación expiró. Pedile al owner que te invite de nuevo.",
      no_token: "Falta el token de invitación en el enlace.",
      unknown: "No pudimos validar la invitación. Probá de nuevo más tarde.",
    };
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-xl font-semibold text-on-background">
            Invitación inválida
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            {messages[reason] ?? messages.unknown}
          </p>
          <Button
            type="button"
            onClick={() => router.push("/auth/login")}
            className="mt-6 h-12 bg-primary px-6 font-semibold text-white"
          >
            Ir al login
          </Button>
        </Card>
      </div>
    );
  }

  const { invitation } = preview;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-xl font-semibold text-on-background">
          Aceptar invitación
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Te invitaron a unirte como <strong>{invitation?.role}</strong>.
        </p>

        <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm">
          <p className="text-on-background">
            <strong>Email:</strong> {invitation?.email}
          </p>
          <p className="text-on-surface-variant">
            <strong>Nombre:</strong> {invitation?.name}
          </p>
          <p className="text-on-surface-variant">
            <strong>Expira:</strong>{" "}
            {invitation?.expiresAt
              ? new Date(invitation.expiresAt).toLocaleString("es-ES")
              : "—"}
          </p>
        </div>

        <Form onSubmit={handleAccept} className="mt-6 space-y-4">
          <FormField
            name="password"
            label="Creá tu contraseña"
            field={field("password")}
          >
            <Input
              name="password"
              type="password"
              className="h-12 bg-surface-container-low focus:ring-primary"
              placeholder="Mínimo 6 caracteres"
            />
          </FormField>

          <div className="pt-2">
            <FormSubmit
              className="h-12 w-full bg-primary font-semibold text-white"
              fetchStatus={fetchStatus}
              buttonProps={{ label: "Aceptar y crear cuenta" }}
            />
          </div>
        </Form>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
