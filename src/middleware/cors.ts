import { Context, Next } from 'hono'

interface CorsConfig {
  origin: string | string[] | ((origin: string) => boolean)
  methods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
  preflightContinue?: boolean
  optionsSuccessStatus?: number
}

const defaultConfig: CorsConfig = {
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Request-ID'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204
}

export function cors(config: Partial<CorsConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config }

  return async (c: Context, next: Next) => {
    const origin = c.req.header('origin')

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      // Set CORS headers
      setCorsHeaders(c, origin, finalConfig)
      
      if (!finalConfig.preflightContinue) {
        return c.text('', finalConfig.optionsSuccessStatus as any)
      }
    }

    // Set CORS headers for actual requests
    setCorsHeaders(c, origin, finalConfig)

    await next()
  }
}

function setCorsHeaders(c: Context, origin: string | undefined, config: CorsConfig) {
  // Handle origin
  if (config.origin) {
    if (typeof config.origin === 'function') {
      if (origin && config.origin(origin)) {
        c.header('Access-Control-Allow-Origin', origin)
      }
    } else if (Array.isArray(config.origin)) {
      if (origin && config.origin.includes(origin)) {
        c.header('Access-Control-Allow-Origin', origin)
      }
    } else {
      c.header('Access-Control-Allow-Origin', config.origin)
    }
  }

  // Handle credentials
  if (config.credentials) {
    c.header('Access-Control-Allow-Credentials', 'true')
  }

  // Handle methods
  if (config.methods) {
    c.header('Access-Control-Allow-Methods', config.methods.join(', '))
  }

  // Handle allowed headers
  if (config.allowedHeaders) {
    c.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '))
  }

  // Handle exposed headers
  if (config.exposedHeaders) {
    c.header('Access-Control-Expose-Headers', config.exposedHeaders.join(', '))
  }

  // Handle max age
  if (config.maxAge) {
    c.header('Access-Control-Max-Age', config.maxAge.toString())
  }
}

// Environment-specific CORS configurations
export const corsConfigs = {
  development: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID'
    ]
  },

  production: {
    origin: (origin: string) => {
      // In production, validate against allowed domains
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []
      return allowedOrigins.includes(origin)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID'
    ]
  },

  testing: {
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID'
    ]
  }
}

// Get CORS configuration based on environment
export function getCorsConfig() {
  const env = process.env.NODE_ENV || 'development'
  return corsConfigs[env as keyof typeof corsConfigs] || corsConfigs.development
}

// Helper function to validate origin
export function isValidOrigin(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.includes(origin)
}

// Helper function to get origin from request
export function getOriginFromRequest(c: Context): string | undefined {
  return c.req.header('origin') || 
         c.req.header('referer')?.split('/').slice(0, 3).join('/') ||
         undefined
}
