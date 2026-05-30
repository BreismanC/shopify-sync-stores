import { signIn } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, refreshToken, user } = body;

    console.log('[API /auth/signin] Received:', {
      hasToken: !!token,
      hasRefreshToken: !!refreshToken,
      hasUser: !!user,
    });

    if (!token || !user) {
      return NextResponse.json(
        { error: 'Missing credentials' },
        { status: 400 }
      );
    }

    const result = await signIn('credentials', {
      token,
      refreshToken: refreshToken || token,
      user,
      redirect: false,
      callbackUrl: '/dashboard',
    });

    console.log('[API /auth/signin] signIn result:', result);

    if (result?.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      url: result?.url || '/dashboard' 
    });
  } catch (error) {
    console.error('[API /auth/signin] Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
