import Link from "next/link";
import { User as UserIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface YourAccountCardProps {
  title?: string;
  links: Array<{ label: string; href: string; description?: string }>;
}

export function YourAccountCard({
  title = "Tu cuenta",
  links,
}: YourAccountCardProps) {
  return (
    <Card className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <UserIcon className="h-5 w-5 text-on-surface-variant" aria-hidden />
        <h3 className="text-base font-semibold text-on-background">{title}</h3>
      </div>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block text-sm font-medium text-primary hover:underline"
            >
              {link.label}
            </Link>
            {link.description ? (
              <p className="mt-1 text-sm leading-5 text-on-surface-variant">
                {link.description}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
