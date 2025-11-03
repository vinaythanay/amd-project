import twilio from 'twilio';
import { z } from 'zod';

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  throw new Error('Twilio credentials are required');
}

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Support both US (+1) and Indian (+91) phone numbers
export const phoneNumberSchema = z.string().regex(/^(\+1\d{10}|\+91\d{10})$/, {
  message: 'Phone number must be in E.164 format: US (+1XXXXXXXXXX) or India (+91XXXXXXXXXX)',
});

/**
 * Twilio configuration for AMD
 */
// Get base URL - prioritize TWILIO_WEBHOOK_URL, then NEXTAUTH_URL, then default to port 3004
const getBaseUrl = () => {
  // Make sure we get the actual base URL being used for calls
  return process.env.TWILIO_WEBHOOK_URL || process.env.NEXTAUTH_URL || 'http://localhost:3004';
};

// Build AMD callback URL - ensure it's accessible
const buildAmdCallbackUrl = () => {
  const baseUrl = getBaseUrl();
  // Ensure it's an HTTPS URL (Twilio requires HTTPS for webhooks)
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    console.warn('[TWILIO_CONFIG] ⚠️ WARNING: Using localhost URL for AMD callback. This will NOT work with Twilio unless using ngrok.');
  }
  const callbackUrl = `${baseUrl}/api/webhooks/twilio/amd-status`;
  console.log('[TWILIO_CONFIG] AMD Callback URL:', callbackUrl);
  return callbackUrl;
};

export const TWILIO_CONFIG = {
  machineDetection: 'Enable' as const,
  machineDetectionTimeout: 60, // Increased from 30 to 60 seconds to give more time for detection
  asyncAmd: true,
  asyncAmdStatusCallback: buildAmdCallbackUrl(),
  asyncAmdStatusCallbackMethod: 'POST' as const,
};

