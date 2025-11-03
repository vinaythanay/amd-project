import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/webhooks/jambonz/queue-events
 * 
 * Handles Jambonz queue event callbacks
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Log queue events for debugging
    console.log('Jambonz queue event:', payload);
    
    // Store queue events if needed
    // You can extend this to track call queue status
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Jambonz queue event webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

