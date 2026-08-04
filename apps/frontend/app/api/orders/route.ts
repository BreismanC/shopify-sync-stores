import { auth } from '@/auth';
import { BACKEND_URL } from '@/lib/env';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy para listar los pedidos sincronizados del tenant actual.
 *
 * Reenvía la query al backend (`GET ${BACKEND_URL}/api/tenant/:tenantId/orders`)
 * añadiendo el `Authorization: Bearer` desde la sesión de NextAuth.
 *
 * Query params soportados: `search?`, `page?`, `perPage?`, `status?`,
 * `storeId?`, `sortBy?` (createdAt|updatedAt|status), `order?` (asc|desc).
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.tenantId || !session?.accessToken) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 },
    );
  }

  const tenantId = session.user.tenantId;
  const accessToken = session.accessToken;

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '1';
  const perPage = searchParams.get('perPage') ?? '20';
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const storeId = searchParams.get('storeId');
  const sortBy = searchParams.get('sortBy');
  const order = searchParams.get('order');

  const backendParams = new URLSearchParams();
  backendParams.set('page', page);
  backendParams.set('perPage', perPage);
  if (search && search.trim().length > 0) {
    backendParams.set('search', search);
  }
  if (status && status.trim().length > 0) {
    backendParams.set('status', status);
  }
  if (storeId && storeId.trim().length > 0) {
    backendParams.set('storeId', storeId);
  }
  if (sortBy && sortBy.trim().length > 0) {
    backendParams.set('sortBy', sortBy);
  }
  if (order && order.trim().length > 0) {
    backendParams.set('order', order);
  }

  const upstreamUrl = `${BACKEND_URL}/api/tenant/${tenantId}/orders?${backendParams.toString()}`;

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
        { error: 'Pedidos no encontrados' },
        { status: 404 },
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'Error al obtener los pedidos',
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
