import { auth, signIn } from "@/auth";
import { BACKEND_URL } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { tenantId } = (await request.json()) as { tenantId?: string };
  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId es requerido" },
      { status: 400 },
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/auth/tenant/select`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({ tenantId }),
  });
  const result = await response.json();
  if (!response.ok) {
    return NextResponse.json(result, { status: response.status });
  }

  await signIn("credentials", {
    token: result.access_token,
    refreshToken: result.refresh_token ?? result.access_token,
    user: JSON.stringify(result.user),
    redirect: false,
  });

  return NextResponse.json({
    success: true,
    tenantId,
    onboardingStatus: result.user.onboardingStatus,
  });
}
