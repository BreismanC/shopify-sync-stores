"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";

export function UnauthorizedActions({ ctaLabel }: { ctaLabel: string }) {
  return (
    <>
      <Button
        className="h-12 bg-primary px-6 font-semibold text-primary-foreground"
        onClick={() => signOut({ callbackUrl: "/auth/login" })}
      >
        {ctaLabel}
      </Button>
      <Button
        variant="link"
        className="h-12 px-4 text-on-surface-variant"
        onClick={() => signOut({ callbackUrl: "/auth/login" })}
      >
        Iniciar sesión con otra cuenta
      </Button>
    </>
  );
}
