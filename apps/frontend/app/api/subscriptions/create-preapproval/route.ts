import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cardTokenId, planType, billingPeriod } = body;

    if (!cardTokenId || !planType || !billingPeriod) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos: cardTokenId, planType, billingPeriod' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const authHeader = req.headers.get('Authorization');

    const response = await fetch(
      `${backendUrl}/api/subscriptions/create-preapproval`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ cardTokenId, planType, billingPeriod }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Error al crear preaprobación' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('create-preapproval route error:', error);
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
