import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/session
 * 
 * Get current session
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    return NextResponse.json({ user: session?.user || null });
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}

