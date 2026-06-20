import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tenantName } = body;

    if (!tenantName) {
      return NextResponse.json(
        { error: 'Nombre del tenant es requerido' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    console.log('[API /auth/tenant] session.accessToken:', session.accessToken ? 'present (' + session.accessToken.substring(0, 20) + '...)' : 'MISSING');

    const response = await fetch(`${backendUrl}/api/auth/tenant/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ name: tenantName }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al crear/actualizar tenant');
    }

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /auth/tenant] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    const response = await fetch(`${backendUrl}/api/auth/tenant/my-tenants`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al obtener tenants');
    }

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /auth/tenant] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}