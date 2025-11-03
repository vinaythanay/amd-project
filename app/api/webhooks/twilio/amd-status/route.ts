import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAmdDetector } from '@/lib/amdStrategies';
import { AmdResult } from '@/generated/prisma/enums';

/**
 * POST /api/webhooks/twilio/amd-status
 * 
 * Handles Twilio native AMD status callbacks
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      payload[key] = value.toString();
    });

    const { CallSid, AnsweringMachineDetectionStatus, CallStatus } = payload;

    // Log full payload for debugging
    console.log('[AMD Status Webhook] ========== AMD WEBHOOK RECEIVED ==========');
    console.log('[AMD Status Webhook] CallSid:', CallSid);
    console.log('[AMD Status Webhook] AnsweringMachineDetectionStatus:', AnsweringMachineDetectionStatus);
    console.log('[AMD Status Webhook] CallStatus:', CallStatus);
    console.log('[AMD Status Webhook] Full payload:', JSON.stringify(payload, null, 2));
    console.log('[AMD Status Webhook] All fields:', Object.keys(payload));
    console.log('[AMD Status Webhook] ==========================================');

    if (!CallSid) {
      return NextResponse.json({ error: 'Missing CallSid' }, { status: 400 });
    }

    // Find call
    const call = await prisma.call.findUnique({
      where: { twilioCallSid: CallSid },
    });

    if (!call) {
      console.warn(`[AMD Status] Call not found for SID: ${CallSid}`);
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Process AMD result
    const detector = createAmdDetector(call.amdStrategy as any);
    const result = await detector.handleWebhook?.(payload);

    if (result) {
      console.log(`[AMD Status] Updating call ${call.id} with result: ${result.result} (confidence: ${result.confidence})`);
      
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
          eventType: 'amd_detection_complete',
          amdResult: result.result,
          confidence: result.confidence,
          rawData: payload, // Store full payload for debugging
        },
      });

      // Handle machine detection - hang up if machine
      if (result.result === 'MACHINE' && call.twilioCallSid) {
        // Note: In production, you'd use Twilio API to hang up
        // For now, we log it - actual hangup would require Twilio API call
        console.log(`[AMD Status] Machine detected for call ${call.id}, should hang up`);
      }
    } else {
      // Log when detector doesn't return a result (payload might be incomplete)
      console.warn(`[AMD Status] No result from detector for call ${call.id}. Payload:`, payload);
      
      // Still log the event for debugging
      await prisma.amdEvent.create({
        data: {
          callId: call.id,
          eventType: 'amd_webhook_received',
          amdResult: 'UNDECIDED',
          rawData: payload, // Store what we received
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AMD Status] Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
