"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Send, Trash2Icon } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useOnboardingNavigation } from "@/components/onboarding/OnboardingStepper";
import { apiFetch } from "@/lib/auth";
import { BACKEND_URL } from "@/lib/env";

interface TeamInvitation {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt?: string;
}

interface InvitationDraft {
  name: string;
  email: string;
}

const EMPTY_DRAFT: InvitationDraft = { name: "", email: "" };

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "ACCEPTED":
      return "Aceptada";
    case "EXPIRED":
      return "Expirada";
    default:
      return status;
  }
}

export function Step5Team() {
  const { goToStep, goToSummary } = useOnboardingNavigation();
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken as string | undefined;

  const [team, setTeam] = useState<TeamInvitation[]>([]);
  const [draft, setDraft] = useState<InvitationDraft>(EMPTY_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<
          { team: TeamInvitation[] } | TeamInvitation[]
        >(`${BACKEND_URL}/api/onboarding/team`, { method: "GET" }, accessToken);
        if (cancelled) return;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.team)
            ? data.team
            : [];
        setTeam(list.filter((m) => m.status !== "REVOKED"));
      } catch (err) {
        console.error("Error fetching team:", err);
        if (!cancelled) setTeam([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, status]);

  async function handleInvite() {
    if (!draft.name.trim()) {
      toast.error("Ingresá un nombre");
      return;
    }
    if (!draft.email.includes("@")) {
      toast.error("Email inválido");
      return;
    }
    setIsInviting(true);
    try {
      const data = await apiFetch<{ member: TeamInvitation } | TeamInvitation>(
        `${BACKEND_URL}/api/onboarding/team/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name.trim(),
            email: draft.email.trim().toLowerCase(),
            role: "MEMBER",
          }),
        },
        accessToken,
      );
      const member =
        data && typeof data === "object" && "member" in data
          ? data.member
          : (data as TeamInvitation);
      if (member?.id) {
        setTeam((prev) => {
          const withoutDup = prev.filter(
            (m) => m.id !== member.id && m.email !== member.email,
          );
          return [...withoutDup, member];
        });
      }
      setDraft(EMPTY_DRAFT);
      toast.success("Persona agregada al equipo");
    } catch (err: any) {
      toast.error(err.message || "Error al agregar");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await apiFetch(
        `${BACKEND_URL}/api/onboarding/team/${id}`,
        { method: "DELETE" },
        accessToken,
      );
      setTeam((prev) => prev.filter((m) => m.id !== id));
      toast.success("Eliminado del equipo");
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSendInvites() {
    setIsSending(true);
    try {
      const result = await apiFetch<{ sent: number }>(
        `${BACKEND_URL}/api/onboarding/team/send-invites`,
        { method: "POST" },
        accessToken,
      );
      toast.success(
        result.sent > 0
          ? `${result.sent} invitación(es) enviada(s)`
          : "No hay invitaciones pendientes para enviar",
      );
    } catch (err: any) {
      toast.error(err.message || "Error al enviar invitaciones");
    } finally {
      setIsSending(false);
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
      <Card className="rounded-xl border border-gray-6 bg-gray-1 p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-12 tracking-tight">
          Invita a tu equipo
        </h2>
        <p className="mt-1 text-sm text-gray-11">
          Sumá personas para que te ayuden a gestionar las tiendas. Podés
          agregar varias y enviar las invitaciones todas juntas al final.
        </p>

        <div className="my-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="Nombre"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-12 bg-gray-1 border border-gray-6 rounded-lg text-gray-12 placeholder:text-gray-11 focus:outline-none focus:border-accent-9 focus:ring-2 focus:ring-accent-9/50"
          />
          <Input
            type="email"
            placeholder="email@empresa.com"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            className="h-12 bg-gray-1 border border-gray-6 rounded-lg text-gray-12 placeholder:text-gray-11 focus:outline-none focus:border-accent-9 focus:ring-2 focus:ring-accent-9/50"
          />
          <Button
            type="button"
            onClick={handleInvite}
            isLoading={isInviting}
            isDisabled={!draft.email.includes("@") || !draft.name.trim()}
            className="h-12 px-4 font-semibold bg-accent-9 hover:bg-accent-10 text-white rounded-lg shadow-sm hover:!transform-none active:!transform-none"
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1">Agregar</span>
          </Button>
        </div>

        {team.length > 0 ? (
          <ul className="mt-6 divide-y divide-gray-6 rounded-lg border border-gray-6">
            {team.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-12 truncate">
                    {m.name || m.email}
                  </p>
                  <p className="text-xs text-gray-11 truncate">
                    {m.email}
                    {m.status ? ` · ${statusLabel(m.status)}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="menu"
                  onClick={() => handleDelete(m.id)}
                  isLoading={deletingId === m.id}
                  isDisabled={deletingId !== null}
                  className="h-12 w-12 p-0 text-gray-11 hover:text-danger flex items-center justify-center"
                  aria-label={`Eliminar a ${m.name || m.email}`}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-gray-11">
            No agregaste invitaciones todavía. Si no querés invitar a nadie,
            podés continuar al resumen.
          </p>
        )}

        {team.length > 0 ? (
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={handleSendInvites}
              isLoading={isSending}
              className="h-12 px-6 font-semibold bg-accent-9 hover:bg-accent-10 text-white rounded-lg shadow-sm hover:!transform-none active:!transform-none"
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
          className="h-12 px-4 text-gray-11 hover:bg-gray-3 hover:text-gray-12"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver al paso 4
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={goToSummary}
          className="h-12 px-6 text-gray-11 hover:bg-gray-3 hover:text-gray-12"
        >
          Ir al resumen
        </Button>
      </div>
    </div>
  );
}
