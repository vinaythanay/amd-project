import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/webhooks/jambonz/registration
 * 
 * Handles Jambonz SIP device registration events
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Log registration events for debugging
    console.log('Jambonz registration event:', payload);
    
    // Store registration event if needed
    // You can extend this to track SIP device registrations
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Jambonz registration webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

