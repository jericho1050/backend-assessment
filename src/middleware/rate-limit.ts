import { Context, Next } from 'hono'
import { RateLimitError } from '@/utils/errors'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (c: Context) => string // Custom key generator
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// In-memory store for rate limiting (in production, use Redis)
const store: RateLimitStore = {}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key]
    }
  })
}, 60000) // Clean up every minute

export function createRateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const now = Date.now()
    const key = config.keyGenerator ? config.keyGenerator(c) : getDefaultKey(c)
    
    // Get or create rate limit entry
    let entry = store[key]
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs
      }
      store[key] = entry
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      const resetTime = new Date(entry.resetTime).toISOString()
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
      
      c.header('X-RateLimit-Limit', config.maxRequests.toString())
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', resetTime)
      c.header('Retry-After', retryAfter.toString())
      
      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        {
          limit: config.maxRequests,
          remaining: 0,
          resetTime,
          retryAfter
        }
      )
    }

    // Increment counter
    entry.count++

    // Set rate limit headers
    const remaining = Math.max(0, config.maxRequests - entry.count)
    c.header('X-RateLimit-Limit', config.maxRequests.toString())
    c.header('X-RateLimit-Remaining', remaining.toString())
    c.header('X-RateLimit-Reset', new Date(entry.resetTime).toISOString())

    await next()
  }
}

// Default key generator (IP-based)
function getDefaultKey(c: Context): string {
  const ip = c.req.header('x-forwarded-for') || 
             c.req.header('x-real-ip') || 
             'unknown'
  return `rate_limit:${ip}`
}

// User-based key generator
export function getUserKey(c: Context): string {
  const userId = c.get('userId') as string
  if (!userId) {
    return getDefaultKey(c) // Fallback to IP
  }
  return `rate_limit:user:${userId}`
}

// Predefined rate limit configurations
export const rateLimits = {
  // Strict limits for authentication endpoints
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: process.env.NODE_ENV === 'test' ? 1000 : 5, // Higher limit for tests
    keyGenerator: getDefaultKey
  }),

  // Moderate limits for general API endpoints
  general: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: process.env.NODE_ENV === 'test' ? 10000 : 100, // Higher limit for tests
    keyGenerator: getDefaultKey
  }),

  // Higher limits for authenticated users
  authenticated: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: process.env.NODE_ENV === 'test' ? 10000 : 1000, // Higher limit for tests
    keyGenerator: getUserKey
  }),

  // Very strict limits for admin operations
  admin: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: process.env.NODE_ENV === 'test' ? 1000 : 50, // Higher limit for tests
    keyGenerator: getUserKey
  }),

  // Burst protection for high-frequency endpoints
  burst: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: process.env.NODE_ENV === 'test' ? 1000 : 30, // Higher limit for tests
    keyGenerator: getDefaultKey
  })
}
