import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const session = await auth();
  const { tenantId } = await params;

  if (!session?.user) redirect("/auth/login");
  if (tenantId !== "new" && session.user.tenantId !== tenantId) {
    redirect("/tenant-selector");
  }
  if (tenantId === "new" && session.user.tenantId) {
    redirect(`/tenant/${session.user.tenantId}/dashboard`);
  }

  return <>{children}</>;
}
