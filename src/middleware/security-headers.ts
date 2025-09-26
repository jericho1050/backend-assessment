import { Context, Next } from 'hono'

interface SecurityHeadersConfig {
  contentSecurityPolicy?: string
  strictTransportSecurity?: string
  xFrameOptions?: string
  xContentTypeOptions?: string
  xXssProtection?: string
  referrerPolicy?: string
  permissionsPolicy?: string
}

const defaultConfig: SecurityHeadersConfig = {
  // Content Security Policy - prevent XSS attacks
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),

  // HTTPS enforcement
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',

  // Prevent clickjacking
  xFrameOptions: 'DENY',

  // Prevent MIME type sniffing
  xContentTypeOptions: 'nosniff',

  // XSS protection (legacy but still useful)
  xXssProtection: '1; mode=block',

  // Control referrer information
  referrerPolicy: 'strict-origin-when-cross-origin',

  // Permissions Policy (formerly Feature Policy)
  permissionsPolicy: [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', ')
}

export function securityHeaders(config: SecurityHeadersConfig = {}) {
  const finalConfig = { ...defaultConfig, ...config }

  return async (c: Context, next: Next) => {
    // Set security headers
    if (finalConfig.contentSecurityPolicy) {
      c.header('Content-Security-Policy', finalConfig.contentSecurityPolicy)
    }

    if (finalConfig.strictTransportSecurity) {
      c.header('Strict-Transport-Security', finalConfig.strictTransportSecurity)
    }

    if (finalConfig.xFrameOptions) {
      c.header('X-Frame-Options', finalConfig.xFrameOptions)
    }

    if (finalConfig.xContentTypeOptions) {
      c.header('X-Content-Type-Options', finalConfig.xContentTypeOptions)
    }

    if (finalConfig.xXssProtection) {
      c.header('X-XSS-Protection', finalConfig.xXssProtection)
    }

    if (finalConfig.referrerPolicy) {
      c.header('Referrer-Policy', finalConfig.referrerPolicy)
    }

    if (finalConfig.permissionsPolicy) {
      c.header('Permissions-Policy', finalConfig.permissionsPolicy)
    }

    // Remove server information
    c.header('Server', 'MyCure API')
    c.header('X-Powered-By', 'Hono')

    await next()
  }
}

// Environment-specific configurations
export const securityConfigs = {
  development: {
    contentSecurityPolicy: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow eval in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' ws: wss:", // Allow WebSocket connections
      "font-src 'self'",
      "object-src 'none'",
      "media-src 'self'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; '),
    strictTransportSecurity: undefined, // Don't enforce HTTPS in dev
  },

  production: defaultConfig,

  testing: {
    contentSecurityPolicy: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "media-src 'self'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; '),
    strictTransportSecurity: undefined,
  }
}

// Get configuration based on environment
export function getSecurityConfig() {
  const env = process.env.NODE_ENV || 'development'
  return securityConfigs[env as keyof typeof securityConfigs] || securityConfigs.development
}
