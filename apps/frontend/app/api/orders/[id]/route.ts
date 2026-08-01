import { auth } from '@/auth';
import { BACKEND_URL } from '@/lib/env';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy para obtener el detalle de un pedido sincronizado.
 *
 * Reenvía `GET ${BACKEND_URL}/api/tenant/:tenantId/orders/:id` añadiendo el
 * `Authorization: Bearer` desde la sesión de NextAuth.
 */
export async function GET(
  _request: NextRequest,
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

  const upstreamUrl = `${BACKEND_URL}/api/tenant/${tenantId}/orders/${id}`;

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
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

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'Error al obtener el detalle del pedido',
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
