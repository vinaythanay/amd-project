import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/calls/[id]
 * 
 * Retrieve a specific call by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get call with events
    const call = await prisma.call.findFirst({
      where: {
        id,
        userId: session.user.id, // Ensure user owns the call
      },
      include: {
        amdEvents: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    return NextResponse.json({ call });
  } catch (error) {
    console.error('Get call error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve call' },
      { status: 500 }
    );
  }
}

