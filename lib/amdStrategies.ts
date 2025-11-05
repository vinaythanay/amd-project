import { prisma } from './prisma';
import { twilioClient, TWILIO_CONFIG } from './twilio';
import { CallStatus, AmdResult } from '@/generated/prisma/enums';

/**
 * AMD Strategy Types
 */
export type AmdStrategy = 'twilio_native' | 'jambonz' | 'huggingface' | 'gemini';

export interface AmdDetectionResult {
  result: AmdResult;
  confidence: number;
  rawData?: any;
  latency?: number;
}

export interface AmdDetector {
  /**
   * Initialize AMD detection for a call
   */
  initialize(callId: string, callSid: string): Promise<void>;
  
  /**
   * Process audio stream chunk (for streaming strategies)
   */
  processAudioChunk?(audioBuffer: Buffer, format: 'wav' | 'pcm'): Promise<AmdDetectionResult | null>;
  
  /**
   * Handle webhook events (for async strategies)
   */
  handleWebhook?(payload: any): Promise<AmdDetectionResult | null>;
}

/**
 * Strategy 1: Twilio Native AMD
 * 
 * Uses Twilio's built-in AMD which analyzes call audio using machine learning.
 * Pros: Zero setup, reliable, well-tested
 * Cons: Limited customization, fixed accuracy (~85-90%)
 */
export class TwilioNativeAmd implements AmdDetector {
  async initialize(callId: string, callSid: string): Promise<void> {
    // Twilio native AMD is configured during call creation
    // No additional initialization needed
    await prisma.amdEvent.create({
      data: {
        callId,
        eventType: 'detection_start',
        amdResult: 'UNDECIDED',
        rawData: { strategy: 'twilio_native', callSid },
      },
    });
  }

  async handleWebhook(payload: any): Promise<AmdDetectionResult | null> {
    const { CallSid, AnsweringMachineDetectionStatus, CallStatus } = payload;

    console.log(`[TwilioNativeAmd] Processing webhook for CallSid: ${CallSid}`);
    console.log(`[TwilioNativeAmd] AnsweringMachineDetectionStatus: ${AnsweringMachineDetectionStatus}`);
    console.log(`[TwilioNativeAmd] CallStatus: ${CallStatus}`);
    console.log(`[TwilioNativeAmd] Full payload:`, JSON.stringify(payload, null, 2));

    let result: AmdResult = 'UNDECIDED';
    let confidence = 0.5;

    // Twilio AMD status values:
    // - 'human': A human answered the call
    // - 'fax': A fax machine answered
    // - 'unknown': The system could not determine the answer type
    // - 'machine_start': An answering machine started playing its greeting
    // - 'machine_end_beep': An answering machine detected, beep detected
    // - 'machine_end_silence': An answering machine detected, silence detected
    // - 'machine_end_other': An answering machine detected, other end detected
    // - 'amd_not_supported': AMD not supported for this call

    if (AnsweringMachineDetectionStatus === 'human') {
      result = 'HUMAN';
      confidence = 0.95;
      console.log(`[TwilioNativeAmd] ✅ Detected HUMAN with confidence ${confidence}`);
    } else if (
      AnsweringMachineDetectionStatus === 'machine_start' ||
      AnsweringMachineDetectionStatus === 'machine_end_beep' ||
      AnsweringMachineDetectionStatus === 'machine_end_silence' ||
      AnsweringMachineDetectionStatus === 'machine_end_other' ||
      AnsweringMachineDetectionStatus === 'fax'
    ) {
      result = 'MACHINE';
      confidence = 0.90;
      console.log(`[TwilioNativeAmd] 🤖 Detected MACHINE (${AnsweringMachineDetectionStatus}) with confidence ${confidence}`);
    } else if (AnsweringMachineDetectionStatus === 'unknown') {
      // "unknown" means Twilio couldn't determine - this might be due to:
      // - Poor audio quality
      // - Very short call
      // - Background noise
      // We'll still mark it as UNDECIDED
      result = 'UNDECIDED';
      confidence = 0.5;
      console.log(`[TwilioNativeAmd] ❓ Status is UNKNOWN - marking as UNDECIDED`);
    } else if (AnsweringMachineDetectionStatus === 'amd_not_supported') {
      result = 'UNDECIDED';
      confidence = 0.5;
      console.log(`[TwilioNativeAmd] ⚠️ AMD not supported for this call`);
    } else if (!AnsweringMachineDetectionStatus) {
      // No status provided - might be timeout or not yet determined
      if (CallStatus === 'completed') {
        result = 'TIMEOUT';
        confidence = 0.5;
        console.log(`[TwilioNativeAmd] ⏱️ Call completed without AMD status - marking as TIMEOUT`);
      } else {
        result = 'UNDECIDED';
        confidence = 0.5;
        console.log(`[TwilioNativeAmd] ⏳ No AMD status yet, call still in progress`);
      }
    } else {
      // Unexpected status value
      console.warn(`[TwilioNativeAmd] ⚠️ Unexpected AMD status: ${AnsweringMachineDetectionStatus}`);
      result = 'UNDECIDED';
      confidence = 0.5;
    }

    return {
      result,
      confidence,
      rawData: payload,
    };
  }
}

/**
 * Strategy 2: Jambonz AMD
 * 
 * Uses Jambonz SIP-based AMD with customizable recognizers.
 * Pros: More control, can fine-tune thresholds, better for edge cases
 * Cons: Requires Jambonz setup, SIP configuration overhead
 * 
 * Configuration:
 * - thresholdWordCount: 5 (minimum words to detect)
 * - timers.decisionTimeoutMs: 10000 (10 seconds timeout)
 */
export class JambonzAmd implements AmdDetector {
  private jambonzConfig = {
    thresholdWordCount: 5,
    decisionTimeoutMs: 10000,
  };

  async initialize(callId: string, callSid: string): Promise<void> {
    await prisma.amdEvent.create({
      data: {
        callId,
        eventType: 'detection_start',
        amdResult: 'UNDECIDED',
        rawData: { 
          strategy: 'jambonz', 
          callSid,
          config: this.jambonzConfig,
        },
      },
    });

    // Check if Jambonz is available (fallback to Twilio if not)
    const jambonzAvailable = process.env.JAMBONZ_API_KEY && process.env.JAMBONZ_SIP_ENDPOINT;
    if (!jambonzAvailable) {
      console.warn('[JambonzAmd] Jambonz not configured, will fallback to Twilio Native');
      await prisma.amdEvent.create({
        data: {
          callId,
          eventType: 'jambonz_fallback',
          amdResult: 'UNDECIDED',
          rawData: { reason: 'Jambonz not configured, falling back to Twilio Native' },
        },
      });
    }
  }

  async handleWebhook(payload: any): Promise<AmdDetectionResult | null> {
    const { event_type, data } = payload;

    let result: AmdResult = 'UNDECIDED';
    let confidence = 0.5;

    // Handle Jambonz AMD events
    if (event_type === 'amd_human_detected') {
      result = 'HUMAN';
      confidence = 0.92;
      console.log('[JambonzAmd] ✅ Human detected');
    } else if (event_type === 'amd_machine_detected') {
      result = 'MACHINE';
      confidence = 0.88;
      console.log('[JambonzAmd] 🤖 Machine detected');
    } else if (event_type === 'amd_timeout') {
      result = 'TIMEOUT';
      confidence = 0.5;
      console.log('[JambonzAmd] ⏱️ AMD timeout');
    } else if (event_type === 'amd_error') {
      // Jambonz unavailable - fallback to Twilio
      console.warn('[JambonzAmd] ⚠️ Jambonz error, falling back to Twilio Native');
      result = 'UNDECIDED';
      confidence = 0.5;
    }

    return {
      result,
      confidence,
      rawData: { ...payload, config: this.jambonzConfig },
    };
  }

  /**
   * Get Jambonz configuration for TwiML dial verb
   */
  getConfig() {
    return {
      thresholdWordCount: this.jambonzConfig.thresholdWordCount,
      timers: {
        decisionTimeoutMs: this.jambonzConfig.decisionTimeoutMs,
      },
    };
  }
}

/**
 * Strategy 3: Hugging Face Model AMD
 * 
 * Uses fine-tuned wav2vec model for voicemail detection.
 * Pros: High accuracy potential, customizable model, can fine-tune on custom data
 * Cons: Requires ML service, latency from audio processing, model loading overhead
 */
export class HuggingFaceAmd implements AmdDetector {
  private mlServiceUrl: string;

  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  }

  async initialize(callId: string, callSid: string): Promise<void> {
    await prisma.amdEvent.create({
      data: {
        callId,
        eventType: 'detection_start',
        amdResult: 'UNDECIDED',
        rawData: { strategy: 'huggingface', callSid },
      },
    });
  }

  async processAudioChunk(audioBuffer: Buffer, format: 'wav' | 'pcm' = 'wav'): Promise<AmdDetectionResult | null> {
    try {
      const startTime = Date.now();
      
      // Send audio to ML service
      const response = await fetch(`${this.mlServiceUrl}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Audio-Format': format,
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        throw new Error(`ML service error: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const result: AmdResult = data.label === 'human' ? 'HUMAN' : 'MACHINE';

      return {
        result,
        confidence: data.confidence || 0.5,
        rawData: data,
        latency,
      };
    } catch (error) {
      console.error('HuggingFace AMD error:', error);
      return null;
    }
  }
}

/**
 * Strategy 4: Gemini Flash Real-Time AMD
 * 
 * Uses Google's Gemini 2.5 Flash Live API for multimodal audio analysis.
 * Pros: State-of-the-art LLM, can handle context and nuanced speech
 * Cons: Token costs, potential latency, API rate limits, possible hallucinations
 */
export class GeminiAmd implements AmdDetector {
  private mlServiceUrl: string;

  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  }

  async initialize(callId: string, callSid: string): Promise<void> {
    await prisma.amdEvent.create({
      data: {
        callId,
        eventType: 'detection_start',
        amdResult: 'UNDECIDED',
        rawData: { strategy: 'gemini', callSid },
      },
    });
  }

  async processAudioChunk(audioBuffer: Buffer, format: 'wav' | 'pcm' = 'wav'): Promise<AmdDetectionResult | null> {
    try {
      const startTime = Date.now();
      
      // Send audio to ML service (Gemini endpoint)
      const response = await fetch(`${this.mlServiceUrl}/api/gemini/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Audio-Format': format,
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        throw new Error(`Gemini service error: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const result: AmdResult = data.label === 'human' ? 'HUMAN' : 'MACHINE';

      return {
        result,
        confidence: data.confidence || 0.5,
        rawData: data,
        latency,
      };
    } catch (error) {
      console.error('Gemini AMD error:', error);
      return null;
    }
  }
}

/**
 * Factory function to create AMD detector based on strategy
 */
export function createAmdDetector(strategy: AmdStrategy): AmdDetector {
  switch (strategy) {
    case 'twilio_native':
      return new TwilioNativeAmd();
    case 'jambonz':
      return new JambonzAmd();
    case 'huggingface':
      return new HuggingFaceAmd();
    case 'gemini':
      return new GeminiAmd();
    default:
      throw new Error(`Unknown AMD strategy: ${strategy}`);
  }
}
