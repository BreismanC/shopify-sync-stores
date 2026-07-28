import Link from "next/link";
import { Megaphone } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface HaveYourSayCardProps {
  title?: string;
  links: Array<{ label: string; description: string; href: string }>;
}

export function HaveYourSayCard({
  title = "Contanos tu opinión",
  links,
}: HaveYourSayCardProps) {
  return (
    <Card className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <Megaphone className="h-5 w-5 text-on-surface-variant" aria-hidden />
        <h3 className="text-base font-semibold text-on-background">{title}</h3>
      </div>
      <ul className="mt-5 space-y-4">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block text-sm font-medium text-primary hover:underline"
            >
              {link.label}
            </Link>
            <p className="mt-1 text-sm leading-5 text-on-surface-variant">
              {link.description}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
