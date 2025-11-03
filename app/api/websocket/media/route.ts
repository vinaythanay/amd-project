import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAmdDetector } from '@/lib/amdStrategies';

/**
 * WebSocket handler for Twilio Media Streams
 * 
 * Note: This is a simplified version. In production, you'd need a proper
 * WebSocket server (e.g., using ws library or a separate service).
 * Twilio Media Streams use WebSocket connections for bidirectional audio.
 */
export async function GET(request: NextRequest) {
  // This endpoint would be used with a WebSocket upgrade
  // For full implementation, you'd need a WebSocket server
  // See: https://www.twilio.com/docs/voice/twiml/stream
  
  return new Response('WebSocket endpoint - upgrade required', {
    status: 426,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
    },
  });
}

/**
 * POST handler for testing audio chunks (fallback for non-WebSocket)
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('callId');
    const strategy = searchParams.get('strategy');

    if (!callId || !strategy) {
      return Response.json({ error: 'Missing callId or strategy' }, { status: 400 });
    }

    // Find call
    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      return Response.json({ error: 'Call not found' }, { status: 404 });
    }

    // Get audio buffer
    const audioBuffer = await request.arrayBuffer();

    // Process with detector
    const detector = createAmdDetector(strategy as any);
    
    if (!detector.processAudioChunk) {
      return Response.json({ error: 'Strategy does not support audio processing' }, { status: 400 });
    }

    // Twilio Media Streams typically send PCM format audio
    const result = await detector.processAudioChunk(Buffer.from(audioBuffer), 'pcm');

    if (result) {
      // Update call if confidence is high enough
      if (result.confidence >= 0.7) {
        await prisma.call.update({
          where: { id: call.id },
          data: {
            amdResult: result.result,
            amdConfidence: result.confidence,
          },
        });

        // Log event
        await prisma.amdEvent.create({
          data: {
            callId: call.id,
            eventType: 'amd_detection_complete',
            amdResult: result.result,
            confidence: result.confidence,
            rawData: result.rawData,
          },
        });
      }
    }

    return Response.json({ success: true, result });
  } catch (error) {
    console.error('Media stream error:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

