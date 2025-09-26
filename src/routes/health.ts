#!/usr/bin/env bun
import { Hono } from 'hono'
import { db } from '@/db/database'

const app = new Hono()

app.get('/health', async (c) => {
  try {
    // Check database connection
    const result = db.query('SELECT 1 as health_check').get()
    
    if (!result) {
      throw new Error('Database health check failed')
    }
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      }
    }, 200)
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        database: 'disconnected'
      }
    }, 503)
  }
})

export default app
