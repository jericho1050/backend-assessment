import { z } from 'zod'

// User role enum schema
export const userRoleSchema = z.enum(['admin', 'user', 'guest'])

// User schema - for database results and API responses
export const userSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleSchema,
  is_active: z.preprocess((val) => Boolean(val), z.boolean()), // SQLite returns 0/1
  created_at: z.string(), // ISO datetime string
  updated_at: z.string()  // ISO datetime string
})

// Public user schema - without sensitive data
export const publicUserSchema = userSchema.omit({
  password_hash: true
})

// JWT payload schema
export const jwtPayloadSchema = z.object({
  sub: z.string(), // user id
  email: z.string().email(),
  role: userRoleSchema,
  exp: z.number().optional(),
  iat: z.number().optional(),
  type: z.enum(['access', 'refresh']).optional()
})

// Registration request schema
export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password too long')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'Password must contain at least one letter and one number')
})

// Login request schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
})

// Refresh token request schema
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required')
})

// User creation schema (for database inserts)
export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleSchema.default('user')
})

// User update schema
export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: userRoleSchema.optional(),
  is_active: z.boolean().optional()
})

// Token response schema
export const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal('Bearer').default('Bearer'),
  expires_in: z.number() // seconds
})

// Auth response schema (login/register)
export const authResponseSchema = z.object({
  message: z.string(),
  user: publicUserSchema,
  access_token: z.string(),
  refresh_token: z.string()
})

// Password validation helper
export const passwordValidation = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(100, 'Password too long')
  .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'Password must contain at least one letter and one number')