import { z } from 'zod'

const dateString = z.preprocess((v) => {
  if (v === undefined || v === null) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string') {
    const s = v.trim()
    return s === '' ? null : s
  }
  return null
}, z.string().nullable())

export const taskSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: dateString.optional() // will be null | string when present
})

const toNumber = (v: unknown) => {
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : v
  }
  return v
}

export const taskQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  sort: z.string().optional(),
  page: z.preprocess(toNumber, z.number().min(1).optional()),
  limit: z.preprocess(toNumber, z.number().min(1).max(100).optional()),
  search: z.string().optional()
})