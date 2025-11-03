import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AmdResult } from '@/generated/prisma/enums';
import { z } from 'zod';

const updateAmdResultSchema = z.object({
  amdResult: z.enum(['HUMAN', 'MACHINE', 'UNDECIDED', 'TIMEOUT']),
});

/**
 * PUT /api/calls/[id]/amd-result
 * 
 * Manually update AMD result for a call
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: callId } = await params;
    const body = await request.json();
    const { amdResult } = updateAmdResultSchema.parse(body);

    // Find call and verify ownership
    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Verify user owns this call
    if (call.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Set confidence based on AMD result
    let confidence = 0.5;
    if (amdResult === 'HUMAN') {
      confidence = 0.95;
    } else if (amdResult === 'MACHINE') {
      confidence = 0.90;
    } else if (amdResult === 'UNDECIDED') {
      confidence = 0.5;
    } else if (amdResult === 'TIMEOUT') {
      confidence = 0.5;
    }

    // Update call
    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        amdResult: amdResult as AmdResult,
        amdConfidence: confidence,
      },
    });

    // Log manual update event
    await prisma.amdEvent.create({
      data: {
        callId: call.id,
        eventType: 'amd_manual_update',
        amdResult: amdResult as AmdResult,
        confidence: confidence,
        rawData: {
          source: 'manual_update',
          updatedBy: session.user.id,
          previousResult: call.amdResult,
          previousConfidence: call.amdConfidence,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      call: {
        id: updatedCall.id,
        amdResult: updatedCall.amdResult,
        amdConfidence: updatedCall.amdConfidence,
      },
    });
  } catch (error) {
    console.error('[Update AMD Result] Error:', error);
    console.error('[Update AMD Result] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    // Return more detailed error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

