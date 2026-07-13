import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/Sidebar";
import { auth } from "@/auth";
import { OnboardingStatus, isValidStatus } from "@/lib/auth/onboarding-status";
import type { ProfileWithRole, UserRole } from "@/types";

const VALID_ROLES: UserRole[] = ["OWNER", "ADMIN", "MEMBER"];

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  const status = session.user?.onboardingStatus;
  const isOwner = session.user?.isOwner ?? false;

  if (isValidStatus(status) && status !== OnboardingStatus.COMPLETED) {
    const currentStep = (() => {
      switch (status) {
        case OnboardingStatus.PENDING_TENANT_CONFIG:
          return 1;
        case OnboardingStatus.PENDING_PLAN_SELECTION:
          return 2;
        case OnboardingStatus.PENDING_STORE_CONFIG:
          return 3;
        case OnboardingStatus.PENDING_STORE_ROLE:
          return 4;
        case OnboardingStatus.PENDING_TEAM_CONFIG:
          return 5;
        default:
          return 1;
      }
    })();

    if (isOwner) {
      redirect(`/onboarding?step=${currentStep}`);
    } else if (status !== OnboardingStatus.PENDING_TEAM_CONFIG) {
      redirect("/unauthorized?reason=team-member-not-invited");
    }
  }

  const role = (session.user?.role ?? "MEMBER") as UserRole;
  const profile: ProfileWithRole | null = session.user
    ? {
        id: session.user.id ?? "",
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        tenantId: session.user.tenantId ?? null,
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