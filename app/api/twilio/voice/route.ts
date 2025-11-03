import { NextRequest, NextResponse } from 'next/server';
import { twiml } from 'twilio';

/**
 * POST /api/twilio/voice
 * 
 * Handles inbound calls to your Twilio phone number
 */
export async function POST(request: NextRequest) {
  try {
    const response = new twiml.VoiceResponse();
    
    // Simple greeting for inbound calls
    // For this app, we're focused on outbound calls with AMD
    response.say(
      { voice: 'alice', language: 'en-US' },
      'Hello. This number is used for automated outbound calls. Goodbye.'
    );
    
    response.hangup();

    return new Response(response.toString(), {
      headers: { 
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Twilio Voice] Error:', error);
    // Silent error handling - just hang up gracefully
    const errorResponse = new twiml.VoiceResponse();
    errorResponse.say({ voice: 'alice' }, 'Thank you. Goodbye.');
    errorResponse.hangup();
    return new Response(errorResponse.toString(), {
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      status: 500,
    });
  }
}

