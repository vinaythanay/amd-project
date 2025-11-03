import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/calls
 * 
 * Retrieve paginated call history with filters
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const strategy = searchParams.get('strategy');
    const status = searchParams.get('status');
    const amdResult = searchParams.get('amdResult');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      userId: session.user.id,
    };

    if (strategy) {
      where.amdStrategy = strategy;
    }

    if (status) {
      where.status = status;
    }

    if (amdResult) {
      where.amdResult = amdResult;
    }

    // Get calls and total count
    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { amdEvents: true },
          },
        },
      }),
      prisma.call.count({ where }),
    ]);

    return NextResponse.json({
      calls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get calls error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve calls' },
      { status: 500 }
    );
  }
}

