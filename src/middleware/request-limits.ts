import { Context, Next } from 'hono'
import { ValidationError } from '@/utils/errors'

interface RequestLimitsConfig {
  maxJsonSize?: number
  maxUrlLength?: number
  maxHeaderSize?: number
  maxHeaderCount?: number
  maxQueryParams?: number
  maxQueryValueLength?: number
  maxMultipartSize?: number
  maxMultipartFiles?: number
}

const defaultConfig: RequestLimitsConfig = {
  maxJsonSize: 1024 * 1024, // 1MB
  maxUrlLength: 2048,
  maxHeaderSize: 8192, // 8KB
  maxHeaderCount: 50,
  maxQueryParams: 100,
  maxQueryValueLength: 1024,
  maxMultipartSize: 10 * 1024 * 1024, // 10MB
  maxMultipartFiles: 10
}

export function requestLimits(config: RequestLimitsConfig = {}) {
  const finalConfig = { ...defaultConfig, ...config }

  return async (c: Context, next: Next) => {
    try {
      // Check URL length
      if (c.req.url.length > finalConfig.maxUrlLength!) {
        throw new ValidationError(`URL length exceeds maximum allowed length of ${finalConfig.maxUrlLength} characters`)
      }

      // Check header count and size
      const headers = c.req.headers
      if (headers.size > finalConfig.maxHeaderCount!) {
        throw new ValidationError(`Header count exceeds maximum allowed count of ${finalConfig.maxHeaderCount}`)
      }

      // Check individual header sizes
      for (const [key, value] of headers.entries()) {
        const headerSize = key.length + value.length
        if (headerSize > finalConfig.maxHeaderSize!) {
          throw new ValidationError(`Header size exceeds maximum allowed size of ${finalConfig.maxHeaderSize} bytes`)
        }
      }

      // Check query parameters
      const url = new URL(c.req.url)
      const queryParams = url.searchParams
      
      if (queryParams.size > finalConfig.maxQueryParams!) {
        throw new ValidationError(`Query parameter count exceeds maximum allowed count of ${finalConfig.maxQueryParams}`)
      }

      // Check query parameter values
      for (const [key, value] of queryParams.entries()) {
        if (value.length > finalConfig.maxQueryValueLength!) {
          throw new ValidationError(`Query parameter value length exceeds maximum allowed length of ${finalConfig.maxQueryValueLength} characters`)
        }
      }

      // Check content length for non-GET requests
      if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
        const contentLength = c.req.header('content-length')
        if (contentLength) {
          const size = parseInt(contentLength, 10)
          if (isNaN(size) || size < 0) {
            throw new ValidationError('Invalid content-length header')
          }

          // Check JSON size limit
          const contentType = c.req.header('content-type') || ''
          if (contentType.includes('application/json') && size > finalConfig.maxJsonSize!) {
            throw new ValidationError(`JSON payload size exceeds maximum allowed size of ${finalConfig.maxJsonSize} bytes`)
          }

          // Check multipart size limit
          if (contentType.includes('multipart/form-data') && size > finalConfig.maxMultipartSize!) {
            throw new ValidationError(`Multipart payload size exceeds maximum allowed size of ${finalConfig.maxMultipartSize} bytes`)
          }
        }
      }

      await next()
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      throw new ValidationError('Request validation failed', { originalError: error })
    }
  }
}

// Environment-specific configurations
export const requestLimitConfigs = {
  development: {
    maxJsonSize: 5 * 1024 * 1024, // 5MB
    maxUrlLength: 4096,
    maxHeaderSize: 16384, // 16KB
    maxHeaderCount: 100,
    maxQueryParams: 200,
    maxQueryValueLength: 2048,
    maxMultipartSize: 50 * 1024 * 1024, // 50MB
    maxMultipartFiles: 20
  },

  production: {
    maxJsonSize: 1024 * 1024, // 1MB
    maxUrlLength: 2048,
    maxHeaderSize: 8192, // 8KB
    maxHeaderCount: 50,
    maxQueryParams: 100,
    maxQueryValueLength: 1024,
    maxMultipartSize: 10 * 1024 * 1024, // 10MB
    maxMultipartFiles: 10
  },

  testing: {
    maxJsonSize: 1024 * 1024, // 1MB
    maxUrlLength: 2048,
    maxHeaderSize: 8192, // 8KB
    maxHeaderCount: 50,
    maxQueryParams: 100,
    maxQueryValueLength: 1024,
    maxMultipartSize: 10 * 1024 * 1024, // 10MB
    maxMultipartFiles: 10
  }
}

// Get configuration based on environment
export function getRequestLimitConfig() {
  const env = process.env.NODE_ENV || 'development'
  return requestLimitConfigs[env as keyof typeof requestLimitConfigs] || requestLimitConfigs.development
}

// Helper function to validate JSON payload size
export function validateJsonSize(jsonString: string, maxSize: number = 1024 * 1024): void {
  const size = new TextEncoder().encode(jsonString).length
  if (size > maxSize) {
    throw new ValidationError(`JSON payload size (${size} bytes) exceeds maximum allowed size of ${maxSize} bytes`)
  }
}

// Helper function to validate multipart form data
export function validateMultipartForm(formData: FormData, config: {
  maxSize?: number
  maxFiles?: number
} = {}): void {
  const { maxSize = 10 * 1024 * 1024, maxFiles = 10 } = config

  let totalSize = 0
  let fileCount = 0

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      fileCount++
      totalSize += value.size

      if (fileCount > maxFiles) {
        throw new ValidationError(`File count exceeds maximum allowed count of ${maxFiles}`)
      }

      if (totalSize > maxSize) {
        throw new ValidationError(`Total file size exceeds maximum allowed size of ${maxSize} bytes`)
      }
    }
  }
}

// Helper function to validate request body based on content type
export function validateRequestBody(
  body: string,
  contentType: string,
  config: RequestLimitsConfig = {}
): void {
  const finalConfig = { ...defaultConfig, ...config }

  if (contentType.includes('application/json')) {
    validateJsonSize(body, finalConfig.maxJsonSize)
  } else if (contentType.includes('text/')) {
    const size = new TextEncoder().encode(body).length
    if (size > finalConfig.maxJsonSize!) {
      throw new ValidationError(`Text payload size exceeds maximum allowed size of ${finalConfig.maxJsonSize} bytes`)
    }
  }
}

// Helper function to get request size from headers
export function getRequestSize(c: Context): number {
  const contentLength = c.req.header('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    return isNaN(size) ? 0 : size
  }
  return 0
}

// Helper function to check if request size is within limits
export function isRequestSizeValid(c: Context, maxSize: number): boolean {
  const size = getRequestSize(c)
  return size <= maxSize
}
