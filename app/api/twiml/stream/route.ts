import { NextRequest } from 'next/server';
import { twiml } from 'twilio';

/**
 * GET /api/twiml/stream
 * POST /api/twiml/stream
 * 
 * Generates TwiML with Media Streams for real-time audio processing
 * Twilio can use either GET or POST
 */
async function handleStream(request: NextRequest) {
  const response = new twiml.VoiceResponse();
  
  // Get parameters from either query string (GET) or form data (POST)
  let callId: string | null = null;
  let strategy: string | null = null;
  
  if (request.method === 'GET') {
    const searchParams = request.nextUrl.searchParams;
    callId = searchParams.get('callId');
    strategy = searchParams.get('strategy');
  } else if (request.method === 'POST') {
    const formData = await request.formData();
    callId = formData.get('callId')?.toString() || null;
    strategy = formData.get('strategy')?.toString() || null;
    // Also check query string as fallback
    if (!callId) callId = request.nextUrl.searchParams.get('callId');
    if (!strategy) strategy = request.nextUrl.searchParams.get('strategy');
  }

  const baseUrl = process.env.TWILIO_WEBHOOK_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  // Start media stream for real-time AMD
  const start = response.start();
  start.stream({
    url: `wss://${new URL(baseUrl).host}/api/websocket/media?callId=${callId}&strategy=${strategy}`,
    name: callId || 'unknown',
  });

  // Greet caller
  response.say(
    { voice: 'alice' },
    'Hello, connecting you now.'
  );

  // In production, add redirect to live handler after greeting

  return new Response(response.toString(), {
    headers: { 
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function GET(request: NextRequest) {
  return handleStream(request);
}

export async function POST(request: NextRequest) {
  return handleStream(request);
}

