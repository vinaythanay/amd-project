import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/debug/amd-status
 * 
 * Diagnostic endpoint to check AMD webhook reception and call status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const callSid = searchParams.get('callSid');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (callSid) {
      // Get specific call details
      const call = await prisma.call.findUnique({
        where: { twilioCallSid: callSid },
        include: {
          amdEvents: {
            orderBy: { timestamp: 'desc' },
            take: 20,
          },
        },
      });

      if (!call) {
        return NextResponse.json({ error: 'Call not found' }, { status: 404 });
      }

      return NextResponse.json({
        call: {
          id: call.id,
          twilioCallSid: call.twilioCallSid,
          targetNumber: call.targetNumber,
          amdStrategy: call.amdStrategy,
          status: call.status,
          amdResult: call.amdResult,
          amdConfidence: call.amdConfidence,
          duration: call.duration,
          createdAt: call.createdAt,
          updatedAt: call.updatedAt,
        },
        amdEvents: call.amdEvents.map(e => ({
          id: e.id,
          eventType: e.eventType,
          amdResult: e.amdResult,
          confidence: e.confidence,
          timestamp: e.timestamp,
          rawData: e.rawData,
        })),
        summary: {
          totalEvents: call.amdEvents.length,
          detectionEvents: call.amdEvents.filter(e => 
            e.eventType === 'amd_detection_complete'
          ).length,
          webhookEvents: call.amdEvents.filter(e => 
            e.eventType === 'amd_webhook_received'
          ).length,
          timeoutEvents: call.amdEvents.filter(e => 
            e.eventType === 'amd_timeout'
          ).length,
        },
      });
    }

    // Get recent calls with AMD status
    const recentCalls = await prisma.call.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        amdEvents: {
          orderBy: { timestamp: 'desc' },
          take: 3,
        },
      },
    });

    return NextResponse.json({
      recentCalls: recentCalls.map(call => ({
        id: call.id,
        twilioCallSid: call.twilioCallSid,
        targetNumber: call.targetNumber,
        amdStrategy: call.amdStrategy,
        status: call.status,
        amdResult: call.amdResult,
        amdConfidence: call.amdConfidence,
        duration: call.duration,
        createdAt: call.createdAt,
        amdEventsCount: call.amdEvents.length,
        latestEvent: call.amdEvents[0] ? {
          eventType: call.amdEvents[0].eventType,
          amdResult: call.amdEvents[0].amdResult,
          timestamp: call.amdEvents[0].timestamp,
        } : null,
      })),
    });
  } catch (error) {
    console.error('[Debug AMD Status] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


