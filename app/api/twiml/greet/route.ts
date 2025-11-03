import { NextRequest } from 'next/server';
import { twiml } from 'twilio';

/**
 * GET /api/twiml/greet
 * POST /api/twiml/greet
 * 
 * Generates TwiML for greeting and connection
 * Twilio can use either GET or POST, so we support both
 */
async function handleGreet(request: NextRequest) {
  try {
    const response = new twiml.VoiceResponse();
    
    // Get parameters from either query string (GET) or form data (POST)
    let callId: string | null = null;
    let strategy: string | null = null;
    let isListenMode: boolean = false;
    
    if (request.method === 'GET') {
      const searchParams = request.nextUrl.searchParams;
      callId = searchParams.get('callId');
      strategy = searchParams.get('strategy');
      isListenMode = searchParams.has('listen');
    } else if (request.method === 'POST') {
      const formData = await request.formData();
      callId = formData.get('callId')?.toString() || null;
      strategy = formData.get('strategy')?.toString() || null;
      // Check query string as well (for redirects with action URL)
      const searchParams = request.nextUrl.searchParams;
      if (!callId) callId = searchParams.get('callId');
      if (!strategy) strategy = searchParams.get('strategy');
      isListenMode = searchParams.has('listen') || formData.has('listen');
    }

    console.log(`[TwiML Greet] ${request.method} - Generating TwiML for call ${callId}, strategy: ${strategy}`);
    console.log(`[TwiML Greet] Full URL: ${request.url}`);
    console.log(`[TwiML Greet] Headers:`, Object.fromEntries(request.headers.entries()));

    // For AMD to work, we need to give it time to analyze the audio
    // Twilio Native AMD analyzes the first few seconds after call is answered
    
    // Strategy 1: For Twilio Native AMD - wait for detection, then keep call active
    if (strategy === 'twilio_native') {
      // Check if this is the initial greeting or a recursive listen call
      const isInitialGreeting = !isListenMode;
      
      if (isInitialGreeting) {
        // CRITICAL: Twilio AMD needs time to analyze audio after call is answered
        // AMD analyzes the first few seconds (up to machineDetectionTimeout)
        // We must wait AT LEAST 10 seconds before speaking to let AMD work
        // If we speak too early, AMD can't properly detect if it's a human or machine
        
        // Long pause to allow AMD to analyze - this is crucial for AMD to work
        // AMD typically needs 5-10 seconds of silence/initial speech to make a determination
        response.pause({ length: 10 }); // 10 seconds of silence for AMD analysis
        
        // After AMD has had time to analyze, we can greet
        // But keep it short - don't interrupt if the person is still talking
        response.say(
          { voice: 'alice', language: 'en-US' },
          'Hello, I am listening. Please continue.'
        );
      }
      
      // Build the base URL for recursive redirects
      const baseUrl = process.env.TWILIO_WEBHOOK_URL || process.env.NEXTAUTH_URL || 'http://localhost:3004';
      const listenUrl = `${baseUrl}/api/twiml/greet?callId=${callId}&strategy=${strategy}&listen=true`;
      
      // Use Gather to continuously listen - this keeps the call active
      // When Gather times out, it will redirect back to this endpoint with listen=true
      // This creates a recursive loop that keeps listening without repeating the greeting
      const gather = response.gather({
        input: 'speech dtmf', // Listen for both speech and touch-tone
        timeout: 60, // Wait up to 60 seconds for input
        speechTimeout: 'auto', // Auto-detect when user stops speaking
        action: listenUrl, // Redirect back to this endpoint when Gather completes
        method: 'POST', // Use POST for the redirect
      });
      
      // Don't add any Say instructions inside Gather - let the user talk naturally
      // If we're in listen mode, don't say anything
      
      // After gather completes or times out, it will redirect to listenUrl
      // But if action URL fails, continue with a long pause as fallback
      response.redirect({ method: 'POST' }, listenUrl);
      
      // Fallback: Use a very long pause to keep call open (if redirect fails)
      response.pause({ length: 3600 }); // 1 hour pause - call stays open
      
    } else {
      // For other strategies (Jambonz), give time for webhook processing
      // Check if this is the initial greeting or a recursive listen call
      const isInitialGreeting = !isListenMode;
      
      if (isInitialGreeting) {
        // CRITICAL: For other strategies, also wait for analysis
        // Similar pause to allow for webhook processing or analysis
        response.pause({ length: 10 }); // Wait 10 seconds for analysis
        
        // Greet the caller ONCE
        response.say(
          { voice: 'alice', language: 'en-US' },
          'Hello, I am listening. Please continue.'
        );
      }
      
      // Build the base URL for recursive redirects
      const baseUrl = process.env.TWILIO_WEBHOOK_URL || process.env.NEXTAUTH_URL || 'http://localhost:3004';
      const listenUrl = `${baseUrl}/api/twiml/greet?callId=${callId}&strategy=${strategy}&listen=true`;
      
      // Use Gather to continuously listen - recursive pattern
      const gather = response.gather({
        input: 'speech',
        timeout: 60,
        speechTimeout: 'auto',
        action: listenUrl, // Redirect back to this endpoint when Gather completes
        method: 'POST',
      });
      
      // Don't add Say instructions - let the user talk naturally
      
      // After gather completes or times out, redirect to listenUrl
      response.redirect({ method: 'POST' }, listenUrl);
      
      // Fallback: Long pause to keep call open
      response.pause({ length: 3600 }); // 1 hour
    }
    
    // IMPORTANT: We DO NOT call response.hangup() here
    // The call will stay open until:
    // 1. User hangs up (call ends naturally)
    // 2. We explicitly hangup via Twilio API (in webhook handler)
    // 3. Call reaches Twilio's maximum duration (4 hours for most accounts)

    const twimlXml = response.toString();
    console.log(`[TwiML Greet] Generated TwiML:`, twimlXml);

    return new Response(twimlXml, {
      headers: { 
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
      status: 200,
    });
  } catch (error) {
    console.error('[TwiML Greet] Error:', error);
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

export async function GET(request: NextRequest) {
  return handleGreet(request);
}

export async function POST(request: NextRequest) {
  return handleGreet(request);
}

