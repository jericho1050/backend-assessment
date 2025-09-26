// src/middleware/error-handler.ts
import type { Context, Next } from 'hono'
import { logger } from '@/utils/logger'
import { toErrorResponse } from '@/errors'

const getRequestId = (c: Context) => {
  const incoming = c.req.header('x-request-id')
  // @ts-ignore Bun provides crypto.randomUUID
  return incoming || crypto.randomUUID()
}

export const requestContext = async (c: Context, next: Next) => {
  const requestId = getRequestId(c)
  c.set('requestId', requestId)
  await next()
}

export const globalErrorHandler = async (err: unknown, c: Context) => {
  const env = process.env.NODE_ENV || 'development'
  const exposeDetails = env !== 'production'
  const requestId = (c.get('requestId') as string) || ''

  const { body, status } = toErrorResponse(err, exposeDetails)

  logger.error('Request failed', {
    requestId,
    path: c.req.path,
    method: c.req.method,
    status,
    error: (err as any)?.message || String(err),
    code: (err as any)?.code,
  })

  // Hono's c.json has strict status literal typing; cast to any for runtime status numbers
  return c.json(
    {
      ...body,
      // Add correlation id to body too (optional)
      requestId,
    },
    status as any
  )
}