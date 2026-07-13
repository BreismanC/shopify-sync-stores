import Link from "next/link";
import { Megaphone, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface DashboardLink {
  label: string;
  href: string;
  description?: string;
}

interface MetricCardProps {
  label: string;
  value: number;
  period: string;
}

export function MetricCard({ label, value, period }: MetricCardProps) {
  return (
    <Card className="flex min-h-48 flex-col rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
      <p className="max-w-56 text-base leading-5 text-gray-11">{label}</p>
      <p className="mt-6 text-xl font-semibold leading-none tabular-nums text-gray-12">
        {value}
      </p>
      <p className="mt-auto pt-6 text-sm text-gray-10">{period}</p>
    </Card>
  );
}

interface AccountCardProps {
  links: DashboardLink[];
}

export function AccountCard({ links }: AccountCardProps) {
  return (
    <Card className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <UserRound className="size-5 text-gray-11" aria-hidden="true" />
        <h3 className="text-base font-semibold text-gray-12">Tu cuenta</h3>
      </div>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm font-medium text-accent-9 hover:underline"
            >
              {link.label}
            </Link>
            {link.description ? (
              <p className="mt-1 text-sm leading-5 text-gray-11">
                {link.description}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function FeedbackCard() {
  const links: DashboardLink[] = [
    {
      label: "Solicitudes de funciones",
      href: "/dashboard/help/features",
      description: "¿Tenés una idea? Enviala y la evaluamos.",
    },
    {
      label: "Contanos qué pensás",
      href: "/dashboard/help/survey",
      description:
        "Completá una encuesta de 3 minutos para ayudarnos a mejorar.",
    },
  ];

  return (
    <Card className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <Megaphone className="size-5 text-gray-11" aria-hidden="true" />
        <h3 className="text-base font-semibold text-gray-12">
          Contanos tu opinión
        </h3>
      </div>
      <ul className="mt-5 space-y-4">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm font-medium text-accent-9 hover:underline"
            >
              {link.label}
            </Link>
            <p className="mt-1 text-sm leading-5 text-gray-11">
              {link.description}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface GuidesCardProps {
  links: DashboardLink[];
}

export function GuidesCard({ links }: GuidesCardProps) {
  return (
    <Card className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-12">
        Aprendé lo básico
      </h3>
      <ul className="mt-4 divide-y divide-gray-6 border-t border-gray-6">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block py-3 text-sm font-medium text-accent-9 hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex justify-center border-t border-gray-6 pt-4">
        <Link
          href="/dashboard/help"
          className="text-sm font-medium text-accent-9 hover:underline"
        >
          Visitá el centro de ayuda para conocer más
        </Link>
      </div>
    </Card>
  );
}
