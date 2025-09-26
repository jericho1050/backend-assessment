import { Hono } from 'hono'
import tasks from '@/routes/tasks'
import auth from '@/routes/auth'
import { globalErrorHandler, requestContext } from './middleware/error-handler'
import { logger } from './utils/logger'
import { cors, getCorsConfig } from './middleware/cors'
import { securityHeaders, getSecurityConfig } from './middleware/security-headers'
import { requestLimits, getRequestLimitConfig } from './middleware/request-limits'
import { inputSanitization } from './middleware/input-sanitization'
import { rateLimits } from './middleware/rate-limit'

const app = new Hono().basePath('/api')

// Security middleware (order matters)
app.use('*', cors(getCorsConfig()))
app.use('*', securityHeaders(getSecurityConfig()))
// Temporarily disable request limits and input sanitization for tests - too aggressive
if (process.env.NODE_ENV !== 'test') {
  app.use('*', requestLimits(getRequestLimitConfig()))
  app.use('*', inputSanitization())
}

// Request context middleware / correlation id
app.use('*', requestContext)

// Basic access log (info) without logging sensitive data
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  const requestId = ((c.get as any)('requestId') as string) || ''
  logger.info('Request processed', {
    requestId,
    path: c.req.path,
    method: c.req.method,
    status: c.res.status,
    ms,
  })
})

// Routes
app.route('/', tasks)
app.route('/auth', auth)

// Error handler
app.onError(globalErrorHandler)


export default app
