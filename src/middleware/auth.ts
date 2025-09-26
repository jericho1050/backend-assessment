import { Context, Next } from 'hono'
import { jwt } from 'hono/jwt'
import { authConfig } from '@/config/auth'
import { AuthenticationError, ForbiddenError, NotFoundError } from '@/utils/errors'
import { verifyAccessToken, extractTokenFromHeader } from '@/utils/auth.utils'
import { jwtPayloadSchema } from '@/validators/auth'
import type { JWTPayload, UserRole } from '@/types/inferred'

// Basic JWT middleware using Hono's built-in JWT middleware
export const basicJwtAuth = jwt({
  secret: authConfig.jwtSecret,
  cookie: 'token' // Also check cookies
})

// Custom authentication middleware with Zod validation
export const authMiddleware = async (c: Context, next: Next) => {
  try {
    // Get token from Authorization header or cookie
    const authHeader = c.req.header('authorization') || c.req.header('Authorization') || c.req.header('AUTHORIZATION')

    let token: string | null = null

    if (authHeader) {
      token = extractTokenFromHeader(authHeader)
    }

    if (!token) {
      throw new AuthenticationError('No token provided')
    }

    // Verify and validate token with Zod
    const payload = await verifyAccessToken(token)

    // Additional validation
    if (!payload.sub || !payload.email || !payload.role) {
      throw new AuthenticationError('Invalid token payload')
    }

    // Check if token is expired (additional check)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new AuthenticationError('Token expired')
    }

    // Set user context for subsequent middleware/handlers
    c.set('user', payload)
    c.set('userId', payload.sub)
    c.set('userEmail', payload.email)
    c.set('userRole', payload.role)

    await next()
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }
    // Handle any other JWT-related errors
    throw new AuthenticationError('Invalid or expired token')
  }
}

// Optional authentication middleware (doesn't throw if no token)
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('authorization') || c.req.header('Authorization') || c.req.header('AUTHORIZATION')

    let token: string | null = null

    if (authHeader) {
      token = extractTokenFromHeader(authHeader)
    }

    if (token) {
      try {
        const payload = await verifyAccessToken(token)

        // Set user context if token is valid
        c.set('user', payload)
        c.set('userId', payload.sub)
        c.set('userEmail', payload.email)
        c.set('userRole', payload.role)
      } catch (error) {
        // Ignore token errors in optional auth
        console.warn('Invalid token in optional auth:', error)
      }
    }

    await next()
  } catch (error) {
    // Never throw in optional auth
    await next()
  }
}

// Role-based authorization middleware
export const authorize = (...allowedRoles: UserRole[]) => {
  return async (c: Context, next: Next) => {
    const userRole = c.get('userRole') as UserRole

    if (!userRole) {
      // If not authenticated, return 401 as before
      throw new AuthenticationError('Authentication required')
    }

    // Admin can access everything
    if (userRole === 'admin') {
      return await next()
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(userRole)) {
      // User is authenticated but not authorized -> 403
      throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`)
    }

    await next()
  }
}

// Middleware to check task ownership (user can only access their own tasks)
export const checkTaskOwnership = async (c: Context, next: Next) => {
  const taskId = c.req.param('id')
  const userId = c.get('userId') as string
  const userRole = c.get('userRole') as UserRole

  if (!taskId) {
    throw new NotFoundError('Task ID is required')
  }

  if (!userId) {
    throw new AuthenticationError('User ID not found in token')
  }

  // Admins can access any task
  if (userRole === 'admin') {
    return await next()
  }

  // Check if task belongs to user
  const { db } = await import('@/db/database')

  try {
    const stmt = db.query('SELECT user_id FROM tasks WHERE id = ?')
    const task = stmt.get(taskId) as { user_id: number | null } | null

    if (!task) {
      throw new NotFoundError('Task not found')
    }

    // If task has no owner (legacy tasks), allow access for now
    // In production, you might want to handle this differently
    if (task.user_id === null) {
      return await next()
    }

    // Check ownership
    if (task.user_id !== parseInt(userId)) {
      throw new ForbiddenError('You can only access your own tasks')
    }

    await next()
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      throw error
    }
    throw new Error('Error checking task ownership')
  }
}

// Middleware to check if user is admin
export const requireAdmin = async (c: Context, next: Next) => {
  const userRole = c.get('userRole') as UserRole

  if (!userRole) {
    throw new AuthenticationError('Authentication required')
  }

  if (userRole !== 'admin') {
    throw new ForbiddenError('Admin access required')
  }

  await next()
}

// Middleware to check if user account is active
export const requireActiveUser = async (c: Context, next: Next) => {
  const userId = c.get('userId') as string

  if (!userId) {
    throw new AuthenticationError('User ID not found in token')
  }

  // Check if user is still active
  const { findUserById } = await import('@/db/queries/users')

  try {
    const user = await findUserById(userId)

    if (!user) {
      throw new AuthenticationError('User account not found')
    }

    if (!user.is_active) {
      throw new AuthenticationError('User account is deactivated')
    }

    await next()
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }
    throw new AuthenticationError('Error verifying user status')
  }
}

// Combined middleware for common authentication + authorization patterns
export const requireAuth = (roles?: UserRole[]) => {
  return async (c: Context, next: Next) => {
    await authMiddleware(c, async () => {
      if (roles && roles.length > 0) {
        // Enforce role-based authorization first so 403 is returned even if user lookup fails later
        await authorize(...roles)(c, async () => {
          await requireActiveUser(c, next)
        })
      } else {
        await requireActiveUser(c, next)
      }
    })
  }
}