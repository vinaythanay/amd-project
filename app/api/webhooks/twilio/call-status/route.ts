import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CallStatus } from '@/generated/prisma/enums';

/**
 * POST /api/webhooks/twilio/call-status
 * 
 * Handles Twilio call status callbacks
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      payload[key] = value.toString();
    });

    const { CallSid, CallStatus } = payload;

    if (!CallSid) {
      return NextResponse.json({ error: 'Missing CallSid' }, { status: 400 });
    }

    // Find call by Twilio SID
    const call = await prisma.call.findUnique({
      where: { twilioCallSid: CallSid },
    });

    if (!call) {
      console.warn(`Call not found for SID: ${CallSid}`);
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Map Twilio status to our status enum
    let status: CallStatus = 'PENDING';
    switch (CallStatus) {
      case 'ringing':
        status = 'RINGING';
        break;
      case 'answered':
        status = 'ANSWERED';
        break;
      case 'in-progress':
        status = 'IN_PROGRESS';
        break;
      case 'completed':
        status = 'COMPLETED';
        break;
      case 'busy':
        status = 'BUSY';
        break;
      case 'no-answer':
        status = 'NO_ANSWER';
        break;
      case 'failed':
      case 'canceled':
        status = 'FAILED';
        break;
    }

    // Check if AMD status is included in call-status webhook
    const { AnsweringMachineDetectionStatus, CallDuration, Timestamp, AnsweringMachineDetectionType } = payload;
    
    // Log full payload for debugging AMD issues
    console.log(`[Call Status Webhook] ========== CALL STATUS UPDATE ==========`);
    console.log(`[Call Status] CallSid: ${CallSid}`);
    console.log(`[Call Status] CallStatus: ${CallStatus}`);
    console.log(`[Call Status] AnsweringMachineDetectionStatus: ${AnsweringMachineDetectionStatus}`);
    console.log(`[Call Status] AnsweringMachineDetectionType: ${AnsweringMachineDetectionType}`);
    console.log(`[Call Status] CallDuration: ${CallDuration}`);
    console.log(`[Call Status] All fields:`, Object.keys(payload));
    if (call.amdStrategy === 'twilio_native' && AnsweringMachineDetectionStatus) {
      console.log(`[Call Status] ⚠️ AMD STATUS FOUND IN CALL-STATUS WEBHOOK: ${AnsweringMachineDetectionStatus}`);
    }
    console.log(`[Call Status] ================================================`);
    
    // Update call status
    const updateData: any = { status };
    
    // Parse call duration if available
    const callDurationSeconds = CallDuration ? parseInt(CallDuration, 10) : null;
    if (callDurationSeconds !== null) {
      updateData.duration = callDurationSeconds;
    }
    
    // IMPORTANT: Twilio sometimes includes AMD status in call-status webhook
    // This is a fallback if the dedicated AMD webhook doesn't arrive
    // We should process this immediately when we see it
    if (AnsweringMachineDetectionStatus && call.amdStrategy === 'twilio_native') {
      let amdResult = 'UNDECIDED';
      let amdConfidence = 0.5;
      
      // Handle all possible AMD status values
      if (AnsweringMachineDetectionStatus === 'human') {
        amdResult = 'HUMAN';
        amdConfidence = 0.95;
        console.log(`[Call Status] ✅ Detected HUMAN from call-status webhook`);
      } else if (
        AnsweringMachineDetectionStatus === 'machine_start' ||
        AnsweringMachineDetectionStatus === 'machine_end_beep' ||
        AnsweringMachineDetectionStatus === 'machine_end_silence' ||
        AnsweringMachineDetectionStatus === 'machine_end_other' ||
        AnsweringMachineDetectionStatus === 'fax'
      ) {
        amdResult = 'MACHINE';
        amdConfidence = 0.90;
        console.log(`[Call Status] 🤖 Detected MACHINE (${AnsweringMachineDetectionStatus}) from call-status webhook`);
      } else if (AnsweringMachineDetectionStatus === 'unknown') {
        amdResult = 'UNDECIDED';
        amdConfidence = 0.5;
        console.log(`[Call Status] ❓ AMD status is UNKNOWN`);
      } else {
        console.log(`[Call Status] ⚠️ Unexpected AMD status: ${AnsweringMachineDetectionStatus}`);
      }
      
      updateData.amdResult = amdResult;
      updateData.amdConfidence = amdConfidence;
      
      console.log(`[Call Status] ✅ Updated AMD result to ${amdResult} (confidence: ${amdConfidence}) from call-status webhook`);
      
      // Also create an AMD event for tracking
      await prisma.amdEvent.create({
        data: {
          callId: call.id,
          eventType: 'amd_detection_complete',
          amdResult: amdResult,
          confidence: amdConfidence,
          rawData: {
            source: 'call_status_webhook',
            AnsweringMachineDetectionStatus,
            AnsweringMachineDetectionType,
            CallStatus,
            CallDuration,
            Timestamp,
            fullPayload: payload,
          },
        },
      });
    }
    
    // Detect if call ended before AMD completed
    // But first, refresh call to get latest AMD result (in case we just updated it above)
    const latestCall = await prisma.call.findUnique({
      where: { id: call.id },
    });
    const currentAmdResult = latestCall?.amdResult || call.amdResult;
    
    if (status === 'COMPLETED' && currentAmdResult === 'UNDECIDED') {
      const amdTimeoutSeconds = 60; // From TWILIO_CONFIG.machineDetectionTimeout (updated to 60)
      const silenceTimeoutSeconds = 3; // 3 seconds of silence = fallback to human
      
      // Check if call duration is less than AMD timeout
      const endedBeforeAmd = callDurationSeconds !== null && callDurationSeconds < amdTimeoutSeconds;
      
      // Check if we received any AMD webhook (check AMD events)
      const amdEvents = await prisma.amdEvent.findMany({
        where: {
          callId: call.id,
          eventType: { in: ['amd_detection_complete', 'amd_webhook_received'] },
        },
        orderBy: { timestamp: 'desc' },
        take: 1,
      });
      
      const receivedAmdWebhook = amdEvents.length > 0;
      
      // Determine timeout reason
      let timeoutReason = 'unknown';
      if (endedBeforeAmd && callDurationSeconds !== null && callDurationSeconds <= silenceTimeoutSeconds) {
        // 3 seconds of silence = fallback to human (treat as human)
        timeoutReason = `3s silence timeout - treating as human`;
        updateData.amdResult = 'HUMAN';
        updateData.amdConfidence = 0.6; // Lower confidence for timeout fallback
      } else if (endedBeforeAmd) {
        timeoutReason = `Call ended after ${callDurationSeconds}s (before ${amdTimeoutSeconds}s AMD timeout)`;
        updateData.amdResult = 'TIMEOUT';
        updateData.amdConfidence = 0.5;
      } else if (!receivedAmdWebhook) {
        timeoutReason = 'No AMD webhook received before call completion';
        updateData.amdResult = 'TIMEOUT';
        updateData.amdConfidence = 0.5;
      } else {
        timeoutReason = 'AMD webhook received but no detection status provided';
        updateData.amdResult = 'TIMEOUT';
        updateData.amdConfidence = 0.5;
      }
      
      console.log(`[Call Status] ⚠️ Call ${call.id} completed without AMD result: ${timeoutReason}`);
      console.log(`[Call Status] ⚠️ This means AMD webhook was NOT received or did not contain status`);
      console.log(`[Call Status] ⚠️ Check ngrok logs to see if webhook was sent`);
      console.log(`[Call Status] ⚠️ AMD callback URL should be: ${process.env.TWILIO_WEBHOOK_URL || 'NOT SET'}/api/webhooks/twilio/amd-status`);
      
      // Log detailed timeout event
      await prisma.amdEvent.create({
        data: {
          callId: call.id,
          eventType: 'amd_timeout',
          amdResult: 'TIMEOUT',
          confidence: 0.5,
          rawData: {
            reason: timeoutReason,
            callDurationSeconds,
            amdTimeoutSeconds,
            receivedAmdWebhook,
            callStatus: status,
            timestamp: Timestamp || new Date().toISOString(),
          },
        },
      });
    }
    
    await prisma.call.update({
      where: { id: call.id },
      data: updateData,
    });

    // Log event
    await prisma.amdEvent.create({
      data: {
        callId: call.id,
        eventType: 'call_status_update',
        rawData: payload,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Call status webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
