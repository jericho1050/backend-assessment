# API Security Implementation (Task 7.2)

## Overview

This document describes the comprehensive security measures implemented for the Task Management API, including rate limiting, input sanitization, CORS configuration, security headers, and request size limits.

## Security Middleware Stack

The API implements a layered security approach with the following middleware components:

1. **CORS Configuration** - Cross-origin request handling
2. **Security Headers** - HTTP security headers
3. **Request Limits** - Size and parameter validation
4. **Input Sanitization** - XSS and injection prevention
5. **Rate Limiting** - Request frequency control
6. **Authentication** - JWT-based access control

## 1. Rate Limiting Middleware

### Implementation
- **File**: [`src/middleware/rate-limit.ts`](src/middleware/rate-limit.ts)
- **Algorithm**: Sliding window with in-memory store
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`

### Rate Limit Configurations

```typescript
// Authentication endpoints (strict)
auth: {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  keyGenerator: getDefaultKey // IP-based
}

// General API endpoints
general: {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  keyGenerator: getDefaultKey // IP-based
}

// Authenticated users (higher limits)
authenticated: {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // 1000 requests per 15 minutes
  keyGenerator: getUserKey // User-based
}

// Admin operations (strict)
admin: {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50, // 50 requests per hour
  keyGenerator: getUserKey // User-based
}

// Burst protection
burst: {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute
  keyGenerator: getDefaultKey // IP-based
}
```

### Applied Endpoints

- **Authentication**: `/auth/register`, `/auth/login`, `/auth/refresh` (strict limits)
- **Tasks**: `/tasks/*` (general limits)
- **Admin**: `/auth/users` (admin limits)

### Error Response

```json
{
  "success": false,
  "error": "Rate limit exceeded. Try again in 45 seconds.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 2. Security Headers Implementation

### Implementation
- **File**: [`src/middleware/security-headers.ts`](src/middleware/security-headers.ts)
- **Environment-specific**: Different configs for dev/prod/test

### Headers Applied

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
Server: MyCure API
X-Powered-By: Hono
```

### Environment Configurations

#### Development
- Relaxed CSP (allows `unsafe-eval`)
- No HSTS enforcement
- WebSocket connections allowed

#### Production
- Strict CSP
- HSTS enforcement
- Minimal permissions

#### Testing
- Balanced security
- No HSTS enforcement

## 3. CORS Configuration

### Implementation
- **File**: [`src/middleware/cors.ts`](src/middleware/cors.ts)
- **Environment-specific**: Different origins for dev/prod/test

### Configuration

```typescript
// Development
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
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept',
    'Authorization', 'X-API-Key', 'X-Request-ID'
  ]
}

// Production
production: {
  origin: (origin: string) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []
    return allowedOrigins.includes(origin)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: [
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept',
    'Authorization', 'X-API-Key', 'X-Request-ID'
  ]
}
```

### Headers Applied

```http
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-Request-ID
Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-ID
Access-Control-Max-Age: 86400
```

## 4. Input Sanitization

### Implementation
- **File**: [`src/middleware/input-sanitization.ts`](src/middleware/input-sanitization.ts)
- **Scope**: Request body, query parameters, headers

### Sanitization Rules

#### String Validation
- **Max Length**: 10,000 characters
- **Unicode Normalization**: NFC
- **Whitespace Trimming**: Enabled

#### SQL Injection Prevention
```typescript
const sqlInjectionPatterns = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
  /(\b(OR|AND)\s+['"]\s*=\s*['"])/gi,
  /(UNION\s+SELECT)/gi,
  /(DROP\s+TABLE)/gi,
  /(--|\/\*|\*\/)/g,
  /(xp_|sp_)/gi
]
```

#### XSS Prevention
```typescript
const xssPatterns = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>.*?<\/embed>/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
  /@import/gi
]
```

#### HTML Tag Handling
- **Script Tags**: Removed
- **Allowed Tags**: `b`, `i`, `em`, `strong`, `p`, `br`
- **Other Tags**: Removed

### Object Validation
- **Max Depth**: 10 levels
- **Max Array Length**: 1,000 items
- **Recursive Sanitization**: Applied to nested objects

### Error Response

```json
{
  "success": false,
  "error": "Potential SQL injection detected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 5. Request Size Limits

### Implementation
- **File**: [`src/middleware/request-limits.ts`](src/middleware/request-limits.ts)
- **Environment-specific**: Different limits for dev/prod/test

### Size Limits

#### Development
```typescript
{
  maxJsonSize: 5 * 1024 * 1024, // 5MB
  maxUrlLength: 4096,
  maxHeaderSize: 16384, // 16KB
  maxHeaderCount: 100,
  maxQueryParams: 200,
  maxQueryValueLength: 2048,
  maxMultipartSize: 50 * 1024 * 1024, // 50MB
  maxMultipartFiles: 20
}
```

#### Production
```typescript
{
  maxJsonSize: 1024 * 1024, // 1MB
  maxUrlLength: 2048,
  maxHeaderSize: 8192, // 8KB
  maxHeaderCount: 50,
  maxQueryParams: 100,
  maxQueryValueLength: 1024,
  maxMultipartSize: 10 * 1024 * 1024, // 10MB
  maxMultipartFiles: 10
}
```

### Validation Rules

1. **URL Length**: Maximum 2048 characters
2. **Header Count**: Maximum 50 headers
3. **Header Size**: Maximum 8KB per header
4. **Query Parameters**: Maximum 100 parameters
5. **Query Value Length**: Maximum 1024 characters
6. **JSON Payload**: Maximum 1MB
7. **Multipart Data**: Maximum 10MB
8. **File Count**: Maximum 10 files

### Error Response

```json
{
  "success": false,
  "error": "JSON payload size exceeds maximum allowed size of 1048576 bytes",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 6. File Upload Validation

### Implementation
- **Function**: `validateFileUpload()` in input sanitization middleware
- **Scope**: File type, size, and extension validation

### Validation Rules

```typescript
const config = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'text/plain'
  ],
  allowedExtensions: [
    '.jpg', '.jpeg', '.png', '.gif', '.txt'
  ]
}
```

### Filename Sanitization

```typescript
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 255)
}
```

## 7. Security Metrics and Logging

### Request Context
- **Correlation ID**: Unique identifier for each request
- **Request Timing**: Start/end timestamps
- **Security Events**: Rate limit hits, validation failures

### Logging Format

```json
{
  "requestId": "req_1234567890",
  "path": "/api/tasks",
  "method": "POST",
  "status": 400,
  "ms": 45,
  "securityEvent": "validation_failed",
  "error": "Potential SQL injection detected"
}
```

## 8. Environment Configuration

### Environment Variables

```bash
# CORS Configuration
ALLOWED_ORIGINS=https://myapp.com,https://admin.myapp.com

# Rate Limiting
RATE_LIMIT_REDIS_URL=redis://localhost:6379

# Security Headers
NODE_ENV=production
```

### Configuration Loading

```typescript
// Automatic environment detection
const env = process.env.NODE_ENV || 'development'
const config = getSecurityConfig() // Returns env-specific config
```

## 9. Performance Impact

### Middleware Order
1. **CORS** - Early rejection of invalid origins
2. **Security Headers** - Minimal overhead
3. **Request Limits** - Early validation
4. **Input Sanitization** - Moderate overhead
5. **Rate Limiting** - Minimal overhead
6. **Authentication** - JWT verification

### Optimization Strategies
- **Early Rejection**: Invalid requests rejected before processing
- **Caching**: Rate limit data cached in memory
- **Lazy Validation**: Only validate when needed
- **Batch Processing**: Multiple validations in single pass

## 10. Testing Security Measures

### Test Cases

```typescript
// Rate limiting tests
describe('Rate Limiting', () => {
  it('should block requests exceeding limit', async () => {
    // Make 6 requests to /auth/login
    // Expect 429 on 6th request
  })
})

// Input sanitization tests
describe('Input Sanitization', () => {
  it('should block SQL injection attempts', async () => {
    const payload = { title: "'; DROP TABLE tasks; --" }
    // Expect 400 with validation error
  })
})

// CORS tests
describe('CORS', () => {
  it('should reject invalid origins', async () => {
    // Request with invalid origin
    // Expect CORS error
  })
})
```

### Security Headers Tests

```typescript
describe('Security Headers', () => {
  it('should include all security headers', async () => {
    const response = await app.request('/api/tasks')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Content-Security-Policy')).toBeDefined()
  })
})
```

## 11. Monitoring and Alerting

### Security Metrics
- **Rate Limit Hits**: Track frequency and patterns
- **Validation Failures**: Monitor attack attempts
- **Request Size Violations**: Track potential DoS attempts
- **CORS Violations**: Monitor unauthorized access attempts

### Alerting Thresholds
- **Rate Limit**: > 10 hits per minute
- **Validation Failures**: > 5 per minute
- **Large Requests**: > 5MB payloads
- **Invalid Origins**: Any unauthorized origin

## 12. Best Practices

### Development
1. **Test Security Measures**: Include security tests in CI/CD
2. **Monitor Logs**: Watch for security events during development
3. **Environment Isolation**: Use different configs for dev/staging/prod
4. **Regular Updates**: Keep security dependencies updated

### Production
1. **Monitor Metrics**: Track security-related metrics
2. **Incident Response**: Have procedures for security incidents
3. **Regular Audits**: Periodic security assessments
4. **Backup Strategies**: Plan for security middleware failures

### Maintenance
1. **Pattern Updates**: Regularly update attack patterns
2. **Limit Tuning**: Adjust limits based on usage patterns
3. **Header Updates**: Keep security headers current
4. **Dependency Updates**: Maintain security libraries

## Conclusion

The Task Management API implements comprehensive security measures through a layered middleware approach. The implementation provides:

- **Rate Limiting**: Prevents abuse and DoS attacks
- **Security Headers**: Protects against XSS, clickjacking, and other attacks
- **CORS Configuration**: Controls cross-origin access
- **Input Sanitization**: Prevents injection attacks
- **Request Limits**: Prevents resource exhaustion
- **Environment-specific**: Different security levels for different environments

All security measures are designed to be performant, maintainable, and easily configurable for different deployment environments.
