import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { twilioClient, TWILIO_CONFIG, phoneNumberSchema } from '@/lib/twilio';
import { prisma } from '@/lib/prisma';
import { createAmdDetector, AmdStrategy } from '@/lib/amdStrategies';
import { checkDialRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

const dialSchema = z.object({
  targetNumber: phoneNumberSchema,
  amdStrategy: z.enum(['twilio_native', 'jambonz', 'huggingface', 'gemini']),
});

/**
 * POST /api/dial
 * 
 * Initiates an outbound call with selected AMD strategy
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitSuccess = await checkDialRateLimit(ip);
    if (!rateLimitSuccess) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Authentication
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetNumber, amdStrategy } = dialSchema.parse(body);

    // Create call record
    const call = await prisma.call.create({
      data: {
        userId: session.user.id,
        targetNumber,
        amdStrategy: amdStrategy as AmdStrategy,
        status: 'PENDING',
        amdResult: 'UNDECIDED',
      },
    });

    // Initialize AMD detector
    const detector = createAmdDetector(amdStrategy as AmdStrategy);

    // Build TwiML URL based on strategy
    // Twilio requires a publicly accessible HTTPS URL
    // For local dev, use ngrok: https://ngrok.com/
    const baseUrl = process.env.TWILIO_WEBHOOK_URL || process.env.NEXTAUTH_URL || 'http://localhost:3004';
    
    // Check if using localhost (not accessible to Twilio)
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      return NextResponse.json(
        { 
          error: 'Twilio requires a publicly accessible HTTPS URL. Please use ngrok or set TWILIO_WEBHOOK_URL in .env',
          hint: 'Run: ngrok http 3004 (then set TWILIO_WEBHOOK_URL=https://your-ngrok-url.ngrok.io)'
        },
        { status: 400 }
      );
    }
    
    let statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/call-status`;
    
    // Configure call based on strategy
    let callParams: any = {
      to: targetNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      record: false,
    };

    // Add AMD configuration for Twilio native
    if (amdStrategy === 'twilio_native') {
      callParams = {
        ...callParams,
        machineDetection: TWILIO_CONFIG.machineDetection,
        machineDetectionTimeout: TWILIO_CONFIG.machineDetectionTimeout,
        asyncAmd: TWILIO_CONFIG.asyncAmd,
        asyncAmdStatusCallback: TWILIO_CONFIG.asyncAmdStatusCallback,
        asyncAmdStatusCallbackMethod: TWILIO_CONFIG.asyncAmdStatusCallbackMethod,
      };
      
      // Log AMD configuration for debugging
      console.log('[Dial] Twilio Native AMD Configuration:');
      console.log('  - machineDetection:', TWILIO_CONFIG.machineDetection);
      console.log('  - machineDetectionTimeout:', TWILIO_CONFIG.machineDetectionTimeout, 'seconds');
      console.log('  - asyncAmd:', TWILIO_CONFIG.asyncAmd);
      console.log('  - asyncAmdStatusCallback:', TWILIO_CONFIG.asyncAmdStatusCallback);
      console.log('  - asyncAmdStatusCallbackMethod:', TWILIO_CONFIG.asyncAmdStatusCallbackMethod);
    }

    // For streaming strategies (HuggingFace, Gemini), use Media Streams
    if (amdStrategy === 'huggingface' || amdStrategy === 'gemini') {
      callParams.url = `${baseUrl}/api/twiml/stream?callId=${call.id}&strategy=${amdStrategy}`;
    } else {
      // For Twilio native and Jambonz, use simpler TwiML
      callParams.url = `${baseUrl}/api/twiml/greet?callId=${call.id}&strategy=${amdStrategy}`;
    }

    // Make the call
    const twilioCall = await twilioClient.calls.create(callParams);

    // Update call with Twilio SID
    await prisma.call.update({
      where: { id: call.id },
      data: {
        twilioCallSid: twilioCall.sid,
        status: 'RINGING',
      },
    });

    // Initialize detector
    try {
      await detector.initialize(call.id, twilioCall.sid);
    } catch (detectorError) {
      console.warn('Detector initialization failed (non-critical):', detectorError);
      // Continue even if detector init fails
    }

    return NextResponse.json({
      success: true,
      call: {
        id: call.id,
        status: 'RINGING',
        twilioCallSid: twilioCall.sid,
        amdStrategy,
      },
    });
  } catch (error) {
    console.error('Dial error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    // Return more specific error messages
    let errorMessage = 'Failed to initiate call';
    let errorDetails = null;

    if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = error.message as string;
    }

    // Check for Twilio-specific errors
    if (error && typeof error === 'object' && 'code' in error) {
      errorDetails = {
        code: (error as any).code,
        moreInfo: (error as any).moreInfo,
        status: (error as any).status,
      };
      errorMessage = (error as any).message || errorMessage;
    }

    // If call was created but Twilio call failed, we might want to update call status
    // For now, just return error

    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
