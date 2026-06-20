"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, Trash2, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OnboardingStatus } from "@/lib/auth/onboarding-status";
import { useOnboardingNavigation } from "@/components/onboarding/OnboardingStepper";
import { apiFetch } from "@/lib/auth";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface TeamMember {
  id: string;
  userId: string;
  tenantId: string;
  role: string;
  createdAt: string;
}

interface InvitationDraft {
  name: string;
  email: string;
  role: string;
}

const EMPTY_DRAFT: InvitationDraft = { name: "", email: "", role: "MEMBER" };

export function Step5Team() {
  const { goToStep, goToSummary } = useOnboardingNavigation();
  const { data: session } = useSession();
  const accessToken = session?.accessToken as string | undefined;

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [draft, setDraft] = useState<InvitationDraft>(EMPTY_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ team: TeamMember[] }>(
          `${BACKEND_URL}/api/onboarding/team`,
          { method: "GET" },
          accessToken,
        );
        if (!cancelled) setTeam(data.team);
      } catch (err) {
        console.error("Error fetching team:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleInvite() {
    if (!draft.email.includes("@")) {
      toast.error("Email inválido");
      return;
    }
    setIsInviting(true);
    try {
      const data = await apiFetch<{ member: TeamMember }>(
        `${BACKEND_URL}/api/onboarding/team/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
        accessToken,
      );
      setTeam((prev) => [...prev, data.member]);
      setDraft(EMPTY_DRAFT);
      toast.success("Invitación agregada");
    } catch (err: any) {
      toast.error(err.message || "Error al invitar");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(
        `${BACKEND_URL}/api/onboarding/team/${id}`,
        { method: "DELETE" },
        accessToken,
      );
      setTeam((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  }

  async function handleSendInvites() {
    try {
      await apiFetch(
        `${BACKEND_URL}/api/onboarding/team/send-invites`,
        { method: "POST" },
        accessToken,
      );
      toast.success("Invitaciones enviadas");
    } catch (err: any) {
      toast.error(err.message || "Error al enviar invitaciones");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-on-background">
          Invita a tu equipo
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Sumá personas para que te ayuden a gestionar las tiendas. Podés
          agregar varias y enviar las invitaciones todas juntas al final.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto]">
          <Input
            placeholder="Nombre"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-12 bg-surface-container-low"
          />
          <Input
            type="email"
            placeholder="email@empresa.com"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            className="h-12 bg-surface-container-low"
          />
          <Input
            placeholder="Rol (ej: MEMBER)"
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            className="h-12 bg-surface-container-low"
          />
          <Button
            type="button"
            onClick={handleInvite}
            isLoading={isInviting}
            isDisabled={!draft.email.includes("@")}
            className="h-12 bg-primary px-4 font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1">Agregar</span>
          </Button>
        </div>

        {team.length > 0 ? (
          <ul className="mt-6 divide-y divide-outline-variant rounded-lg border border-outline-variant">
            {team.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-on-background">
                    {m.userId}
                  </p>
                  <p className="text-xs text-on-surface-variant">{m.role}</p>
                </div>
                <Button
                  type="button"
                  variant="pill"
                  onClick={() => handleDelete(m.id)}
                  className="h-9 px-3"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-on-surface-variant">
            No agregaste invitaciones todavía. Si no querés invitar a nadie,
            podés continuar al resumen.
          </p>
        )}

        {team.length > 0 ? (
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={handleSendInvites}
              className="h-12 px-6 font-semibold"
              variant="pill"
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar invitaciones
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="link"
          onClick={() => goToStep(4)}
          className="h-12 px-4 text-on-surface-variant"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver al paso 4
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={goToSummary}
          className="h-12 px-6 text-on-surface-variant"
        >
          Ir al resumen
        </Button>
      </div>
    </div>
  );
}
