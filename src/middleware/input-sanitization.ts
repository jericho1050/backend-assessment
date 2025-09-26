import { Context, Next } from 'hono'
import { ValidationError } from '@/utils/errors'

interface SanitizationConfig {
  maxStringLength?: number
  maxObjectDepth?: number
  maxArrayLength?: number
  allowedHtmlTags?: string[]
  removeScriptTags?: boolean
  normalizeUnicode?: boolean
  trimWhitespace?: boolean
}

const defaultConfig: SanitizationConfig = {
  maxStringLength: 10000,
  maxObjectDepth: 10,
  maxArrayLength: 1000,
  allowedHtmlTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
  removeScriptTags: true,
  normalizeUnicode: true,
  trimWhitespace: true
}

// HTML tag removal regex
const scriptTagRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
const htmlTagRegex = /<[^>]*>/g

// SQL injection patterns (more specific to avoid false positives)
const sqlInjectionPatterns = [
  /(UNION\s+SELECT)/gi,
  /(DROP\s+TABLE)/gi,
  /(DELETE\s+FROM)/gi,
  /(INSERT\s+INTO)/gi,
  /(UPDATE\s+SET)/gi,
  /(--|\/\*|\*\/)/g,
  /(xp_|sp_)/gi,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
  /(\b(OR|AND)\s+['"]\s*=\s*['"])/gi
]

// XSS patterns (more specific to avoid false positives)
const xssPatterns = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>.*?<\/embed>/gi,
  /expression\s*\(/gi
]

export function inputSanitization(config: SanitizationConfig = {}) {
  const finalConfig = { ...defaultConfig, ...config }

  return async (c: Context, next: Next) => {
    try {
      // Only sanitize request body for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
        const contentType = c.req.header('content-type') || ''
        if (contentType.includes('application/json')) {
          try {
            const body = await c.req.json()
            if (body) {
              const sanitizedBody = sanitizeValue(body, finalConfig)
              // Store sanitized body in context for route handlers to use
              c.set('sanitizedBody', sanitizedBody)
            }
          } catch (error) {
            // If JSON parsing fails, let the route handler deal with it
            // Don't block the request here
          }
        }
      }

      // Sanitize query parameters (only for potentially dangerous patterns)
      const url = new URL(c.req.url)
      for (const [key, value] of url.searchParams.entries()) {
        // Only check for obvious SQL injection patterns in query params
        // Skip validation for common safe parameters
        if (['page', 'limit', 'sort', 'order', 'status', 'priority'].includes(key.toLowerCase())) {
          continue
        }
        if (containsSqlInjection(value) || containsXss(value)) {
          throw new ValidationError('Potentially malicious input detected in query parameters')
        }
      }

      await next()
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      // Don't block requests for sanitization errors, just log them
      console.warn('Input sanitization warning:', error)
      await next()
    }
  }
}

function sanitizeValue(value: any, config: SanitizationConfig, depth = 0): any {
  // Check depth limit
  if (depth > config.maxObjectDepth!) {
    throw new ValidationError('Object depth exceeds maximum allowed')
  }

  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    return sanitizeString(value, config)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    if (value.length > config.maxArrayLength!) {
      throw new ValidationError('Array length exceeds maximum allowed')
    }
    return value.map(item => sanitizeValue(item, config, depth + 1))
  }

  if (typeof value === 'object') {
    const sanitized: any = {}
    for (const [key, val] of Object.entries(value)) {
      const sanitizedKey = sanitizeString(key, config)
      sanitized[sanitizedKey] = sanitizeValue(val, config, depth + 1)
    }
    return sanitized
  }

  return value
}

function containsSqlInjection(str: string): boolean {
  for (const pattern of sqlInjectionPatterns) {
    if (pattern.test(str)) {
      return true
    }
  }
  return false
}

function containsXss(str: string): boolean {
  for (const pattern of xssPatterns) {
    if (pattern.test(str)) {
      return true
    }
  }
  return false
}

function sanitizeString(str: string, config: SanitizationConfig): string {
  if (typeof str !== 'string') {
    return str
  }

  // Check length limit
  if (str.length > config.maxStringLength!) {
    throw new ValidationError('String length exceeds maximum allowed')
  }

  let sanitized = str

  // Trim whitespace
  if (config.trimWhitespace) {
    sanitized = sanitized.trim()
  }

  // Normalize Unicode
  if (config.normalizeUnicode) {
    sanitized = sanitized.normalize('NFC')
  }

  // Check for SQL injection patterns
  if (containsSqlInjection(sanitized)) {
    throw new ValidationError('Potential SQL injection detected')
  }

  // Check for XSS patterns
  if (containsXss(sanitized)) {
    throw new ValidationError('Potential XSS attack detected')
  }

  // Remove script tags
  if (config.removeScriptTags) {
    sanitized = sanitized.replace(scriptTagRegex, '')
  }

  // Remove HTML tags (except allowed ones)
  if (config.allowedHtmlTags && config.allowedHtmlTags.length > 0) {
    const allowedTagsRegex = new RegExp(
      `</?(?!${config.allowedHtmlTags.join('|')})\\w+[^>]*>`,
      'gi'
    )
    sanitized = sanitized.replace(allowedTagsRegex, '')
  } else {
    sanitized = sanitized.replace(htmlTagRegex, '')
  }

  return sanitized
}

function isSecuritySensitiveHeader(headerName: string): boolean {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-csrf-token',
    'x-requested-with',
    'user-agent',
    'referer',
    'origin'
  ]
  
  return sensitiveHeaders.includes(headerName.toLowerCase())
}

// Helper function to validate file uploads
export function validateFileUpload(file: File, config: {
  maxSize?: number
  allowedTypes?: string[]
  allowedExtensions?: string[]
} = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'text/plain'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.txt']
  } = config

  // Check file size
  if (file.size > maxSize) {
    throw new ValidationError(`File size exceeds maximum allowed size of ${maxSize} bytes`)
  }

  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError(`File type ${file.type} is not allowed`)
  }

  // Check file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!allowedExtensions.includes(extension)) {
    throw new ValidationError(`File extension ${extension} is not allowed`)
  }

  return true
}

// Helper function to sanitize filename
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 255)
}
