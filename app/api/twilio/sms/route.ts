import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/twilio/sms
 * 
 * Handles inbound SMS messages to your Twilio phone number
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      payload[key] = value.toString();
    });

    const { From, To, Body } = payload;

    console.log(`[SMS Received] From: ${From}, To: ${To}, Body: ${Body}`);

    // For this app, we're focused on voice calls with AMD
    // SMS handling is minimal - just acknowledge receipt
    // In production, you'd add SMS processing logic here

    return NextResponse.json({ success: true, message: 'SMS received' });
  } catch (error) {
    console.error('[Twilio SMS] Error:', error);
    return NextResponse.json({ error: 'Failed to process SMS' }, { status: 500 });
  }
}

