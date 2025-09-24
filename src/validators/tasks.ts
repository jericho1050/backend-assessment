import { z } from 'zod'

export const taskSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().optional()
})

export const taskQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  sort: z.string().optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
  search: z.string().optional()
})