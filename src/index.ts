import { Hono } from 'hono'
import tasks from '@/routes/tasks'
import auth from '@/routes/auth'
import { globalErrorHandler, requestContext } from './middleware/error-handler'
import { logger } from './utils/logger'

const app = new Hono().basePath('/api')

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
