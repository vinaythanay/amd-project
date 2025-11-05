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

// Audio buffer for chunking (2-5 seconds of audio)
// Twilio Media Streams send audio at 8kHz PCM, 16-bit, mono
// 2 seconds = 16000 samples, 5 seconds = 40000 samples
const AUDIO_BUFFER_SIZE = 32000; // ~2 seconds at 8kHz PCM
const AUDIO_BUFFER_MAX = 80000; // ~5 seconds at 8kHz PCM

// Store buffers per call
const audioBuffers = new Map<string, Buffer>();

/**
 * POST handler for testing audio chunks (fallback for non-WebSocket)
 * Implements audio buffering: accumulate 2-5s WAV chunks before processing
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
    const audioChunk = Buffer.from(await request.arrayBuffer());
    
    // Accumulate audio chunks (buffer 2-5s of audio)
    if (!audioBuffers.has(callId)) {
      audioBuffers.set(callId, Buffer.alloc(0));
    }
    
    const currentBuffer = audioBuffers.get(callId)!;
    const newBuffer = Buffer.concat([currentBuffer, audioChunk]);
    audioBuffers.set(callId, newBuffer);

    // Only process if we have enough audio (2-5 seconds)
    if (newBuffer.length < AUDIO_BUFFER_SIZE) {
      return Response.json({ success: true, buffering: true, bufferSize: newBuffer.length });
    }

    // Process with detector (convert PCM to WAV if needed)
    const detector = createAmdDetector(strategy as any);
    
    if (!detector.processAudioChunk) {
      return Response.json({ error: 'Strategy does not support audio processing' }, { status: 400 });
    }

    // Convert PCM to WAV format for ML models (if needed)
    // For now, pass as PCM - ML service will handle conversion
    const audioToProcess = newBuffer.length > AUDIO_BUFFER_MAX 
      ? newBuffer.slice(0, AUDIO_BUFFER_MAX) // Limit to 5 seconds
      : newBuffer;

    const result = await detector.processAudioChunk(audioToProcess, 'pcm');

    // Clear buffer after processing
    audioBuffers.delete(callId);

    if (result) {
      // Retry logic for low confidence (max 2 retries)
      const existingEvents = await prisma.amdEvent.findMany({
        where: {
          callId: call.id,
          eventType: { contains: 'retry' },
        },
      });
      
      const retryCount = existingEvents.length;
      const maxRetries = 2;
      
      // Update call if confidence is high enough OR max retries reached
      if (result.confidence >= 0.7 || retryCount >= maxRetries) {
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
            eventType: retryCount > 0 ? 'amd_detection_complete_after_retry' : 'amd_detection_complete',
            amdResult: result.result,
            confidence: result.confidence,
            rawData: { ...result.rawData, bufferSize: audioToProcess.length, retryCount },
          },
        });
      } else {
        // Low confidence - log retry attempt
        await prisma.amdEvent.create({
          data: {
            callId: call.id,
            eventType: `amd_retry_${retryCount + 1}`,
            amdResult: result.result,
            confidence: result.confidence,
            rawData: { ...result.rawData, retryReason: 'low_confidence', retryCount: retryCount + 1 },
          },
        });
      }
    }

    return Response.json({ success: true, result, bufferSize: audioToProcess.length });
  } catch (error) {
    console.error('Media stream error:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

