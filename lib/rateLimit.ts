import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Check if Upstash Redis is configured
const hasRedisConfig = 
  process.env.UPSTASH_REDIS_REST_URL && 
  process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
let dialRateLimit: Ratelimit | null = null;
let webhookRateLimit: Ratelimit | null = null;

if (hasRedisConfig) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    dialRateLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 calls per minute
      analytics: true,
    });

    webhookRateLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 webhooks per minute
      analytics: true,
    });
  } catch (error) {
    console.warn('Failed to initialize Upstash Redis:', error);
  }
}

// Fallback rate limiter (in-memory, per-instance)
const inMemoryLimit = new Map<string, { count: number; resetAt: number }>();

function inMemoryRateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const record = inMemoryLimit.get(key);

  if (!record || now > record.resetAt) {
    inMemoryLimit.set(key, {
      count: 1,
      resetAt: now + (windowSeconds * 1000),
    });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

export async function checkDialRateLimit(ip: string): Promise<boolean> {
  if (dialRateLimit) {
    try {
      const { success } = await dialRateLimit.limit(ip);
      return success;
    } catch (error) {
      console.warn('Redis rate limit failed, using in-memory fallback:', error);
    }
  }
  
  // Fallback to in-memory rate limiting (10 calls per minute = 60 seconds)
  return inMemoryRateLimit(`dial:${ip}`, 10, 60);
}

export async function checkWebhookRateLimit(ip: string): Promise<boolean> {
  if (webhookRateLimit) {
    try {
      const { success } = await webhookRateLimit.limit(ip);
      return success;
    } catch (error) {
      console.warn('Redis rate limit failed, using in-memory fallback:', error);
    }
  }
  
  // Fallback to in-memory rate limiting (100 webhooks per minute = 60 seconds)
  return inMemoryRateLimit(`webhook:${ip}`, 100, 60);
}
