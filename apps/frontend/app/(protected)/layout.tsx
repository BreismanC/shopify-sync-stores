import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/Sidebar";
import { auth } from "@/auth";
import {
  OnboardingStatus,
  isValidStatus,
  statusToStep,
} from "@/lib/auth/onboarding-status";
import type { ProfileWithRole, UserRole } from "@/types";

const VALID_ROLES: UserRole[] = ["OWNER", "ADMIN", "MEMBER"];

function canAccessApp(
  status: OnboardingStatus | undefined,
  isOwner: boolean,
): "ok" | "onboarding" | "unauthorized" {
  if (status === OnboardingStatus.COMPLETED) {
    return "ok";
  }

  if (!isValidStatus(status)) {
    return isOwner ? "onboarding" : "unauthorized";
  }

  if (isOwner) {
    return "onboarding";
  }

  if (status === OnboardingStatus.PENDING_TEAM_CONFIG) {
    return "ok";
  }

  return "unauthorized";
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  const isOnboardingPath =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  const status = session.user?.onboardingStatus;
  const role = (session.user?.role ?? "MEMBER") as UserRole;
  const isOwner = session.user?.isOwner ?? role === "OWNER";

  const access = canAccessApp(
    isValidStatus(status) ? status : undefined,
    isOwner,
  );

  // Solo el owner puede entrar al wizard. Los miembros invitados nunca deben
  // completar onboarding; si el tenant llegó a team config, van al dashboard.
  if (isOnboardingPath && !isOwner) {
    if (
      status === OnboardingStatus.PENDING_TEAM_CONFIG ||
      status === OnboardingStatus.COMPLETED
    ) {
      redirect("/dashboard");
    }
    redirect("/unauthorized?reason=team-member-not-invited");
  }

  // En /onboarding el layout hijo maneja steps; no redirigir de nuevo.
  if (access === "onboarding" && !isOnboardingPath) {
    const currentStep = statusToStep(status);
    redirect(`/onboarding?step=${currentStep}`);
  }

  if (access === "unauthorized") {
    redirect("/unauthorized?reason=team-member-not-invited");
  }

  // Onboarding usa su propio chrome (sin sidebar).
  if (isOnboardingPath) {
    return <>{children}</>;
  }

  const profile: ProfileWithRole | null = session.user
    ? {
        id: session.user.id ?? "",
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        tenantId: session.user.tenantId ?? "",
        role: VALID_ROLES.includes(role) ? role : "MEMBER",
        isOwner,
        onboardingStatus: status,
      }
    : null;

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar profile={profile} />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-2 p-2">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
