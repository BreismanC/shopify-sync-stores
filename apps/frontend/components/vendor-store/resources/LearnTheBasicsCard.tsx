import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";

interface LearnTheBasicsCardProps {
  links: Array<{ label: string; href: string }>;
  helpCenterHref?: string;
  helpCenterLabel?: string;
}

export function LearnTheBasicsCard({
  links,
  helpCenterHref = "/dashboard/help",
  helpCenterLabel = "Visitá el centro de ayuda para conocer más",
}: LearnTheBasicsCardProps) {
  return (
    <Card className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <h3 className="text-base font-semibold text-on-background">
        Aprendé lo básico
      </h3>
      <ul className="mt-4 divide-y divide-outline-variant border-t border-outline-variant">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block py-3 text-sm font-medium text-primary hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <Separator className="bg-outline-variant" />
      <div className="flex justify-center pt-4">
        <Link
          href={helpCenterHref}
          className="text-sm font-medium text-primary hover:underline"
        >
          {helpCenterLabel}
        </Link>
      </div>
    </Card>
  );
}
