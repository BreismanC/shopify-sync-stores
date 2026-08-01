import { auth } from '@/auth';
import { BACKEND_URL } from '@/lib/env';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy para empujar manualmente un pedido a la tienda origen.
 *
 * Reenvía `POST ${BACKEND_URL}/api/tenant/:tenantId/orders/:id/push` con el
 * cuerpo `{ shippingFee?: number }` añadiendo el `Authorization: Bearer`
 * desde la sesión de NextAuth.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.tenantId || !session?.accessToken) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 },
    );
  }

  const tenantId = session.user.tenantId;
  const accessToken = session.accessToken;
  const { id } = await params;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const upstreamUrl = `${BACKEND_URL}/api/tenant/${tenantId}/orders/${id}/push`;

  try {
    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    });

    if (response.status === 401) {
      return NextResponse.json(
        { error: 'Sesión expirada o inválida' },
        { status: 401 },
      );
    }

    if (response.status === 404) {
      return NextResponse.json(
        { error: 'Pedido no encontrado' },
        { status: 404 },
      );
    }

    if (response.status === 400) {
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'Solicitud inválida',
          details: text || undefined,
        },
        { status: 400 },
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'Error al empujar el pedido',
          details: text || undefined,
        },
        { status: 500 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      status: 200,
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
