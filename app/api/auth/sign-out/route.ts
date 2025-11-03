import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/sign-out
 * 
 * Sign out current user
 */
export async function POST(request: NextRequest) {
  try {
    await auth.api.signOut({ headers: request.headers });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 });
  }
}

