type Level = 'error' | 'warn' | 'info' | 'debug'

const SENSITIVE_KEYS = new Set(['password', 'token', 'authorization', 'secret', 'apiKey'])

const redact = (obj: any): any => {
  try {
    if (!obj || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return obj.map(redact)
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]'
      } else if (typeof v === 'object' && v !== null) {
        out[k] = redact(v)
      } else {
        out[k] = v
      }
    }
    return out
  } catch {
    return obj
  }
}

const log = (level: Level, message: string, meta?: Record<string, unknown>) => {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? redact(meta) : undefined),
  }
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](JSON.stringify(entry))
}

export const logger = {
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
}