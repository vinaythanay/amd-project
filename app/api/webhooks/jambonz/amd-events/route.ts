import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAmdDetector } from '@/lib/amdStrategies';

/**
 * POST /api/webhooks/jambonz/amd-events
 * 
 * Handles Jambonz AMD webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { call_sid, event_type, data } = payload;

    if (!call_sid) {
      return NextResponse.json({ error: 'Missing call_sid' }, { status: 400 });
    }

    // Find call by Twilio SID (Jambonz may use different format)
    const call = await prisma.call.findFirst({
      where: {
        OR: [
          { twilioCallSid: call_sid },
          { twilioCallSid: { contains: call_sid } },
        ],
      },
    });

    if (!call) {
      console.warn(`Call not found for Jambonz SID: ${call_sid}`);
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Process AMD result
    const detector = createAmdDetector('jambonz');
    const result = await detector.handleWebhook?.(payload);

    if (result) {
      // Update call with AMD result
      await prisma.call.update({
        where: { id: call.id },
        data: {
          amdResult: result.result,
          amdConfidence: result.confidence,
        },
      });

      // Log AMD event
      await prisma.amdEvent.create({
        data: {
          callId: call.id,
          eventType: event_type || 'amd_event',
          amdResult: result.result,
          confidence: result.confidence,
          rawData: payload,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Jambonz AMD webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

