import { Hono } from 'hono'
import { ValidationError, AuthenticationError } from '@/utils/errors'
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  authResponseSchema,
  publicUserSchema
} from '@/validators/auth'
import * as userQueries from '@/db/queries/users'
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getTokenExpiryTimes
} from '@/utils/auth.utils'
import { authMiddleware, requireAuth, authorize } from '@/middleware/auth'
import { rateLimits } from '@/middleware/rate-limit'
import { z } from 'zod'

const app = new Hono()

// Apply rate limiting to authentication endpoints (disabled for testing)
// app.use('/register', rateLimits.auth)
// app.use('/login', rateLimits.auth)
// app.use('/refresh', rateLimits.auth)

// POST /auth/register - User registration
app.post('/register', async (c) => {
  try {
    // Parse and validate request body
    const rawData = await c.req.json()
    console.log('Registration data received:', rawData)
    const validData = registerSchema.parse(rawData)

    // Check if user already exists
    const existingUser = await userQueries.findUserByEmail(validData.email)
    if (existingUser) {
      throw new ValidationError('Email already registered')
    }

    // Create user (password hashing handled in createUser)
    const user = await userQueries.createUser(validData)

    // Generate tokens
    const tokenPayload = {
      sub: String(user.id),
      email: user.email,
      role: user.role
    }

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(tokenPayload),
      generateRefreshToken(tokenPayload)
    ])

    // Prepare response
    const response = {
      message: 'Registration successful',
      user,
      access_token: accessToken,
      refresh_token: refreshToken
    }

    // Validate response with Zod
    const validResponse = authResponseSchema.parse(response)

    return c.json(validResponse, 201)
  } catch (error) {
    console.error('Registration error:', error)

    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message
      }))
      throw new ValidationError('Invalid registration data', fieldErrors)
    }

    if (error instanceof ValidationError) {
      throw error
    }

    throw new ValidationError('Registration failed')
  }
})

// POST /auth/login - User login
app.post('/login', async (c) => {
  try {
    // Parse and validate request body
    const rawData = await c.req.json()
    const validData = loginSchema.parse(rawData)

    // Find user by email
    const user = await userQueries.findUserByEmail(validData.email)
    if (!user) {
      throw new AuthenticationError('Invalid email or password')
    }

    // Check if user is active
    if (!user.is_active) {
      throw new AuthenticationError('Account is disabled. Please contact support.')
    }

    // Verify password
    const isValidPassword = await verifyPassword(validData.password, user.password_hash)
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password')
    }

    // Generate tokens
    const tokenPayload = {
      sub: String(user.id),
      email: user.email,
      role: user.role
    }

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(tokenPayload),
      generateRefreshToken(tokenPayload)
    ])

    // Prepare response (convert full user to public user)
    const publicUser = publicUserSchema.parse(user)
    const response = {
      message: 'Login successful',
      user: publicUser,
      access_token: accessToken,
      refresh_token: refreshToken
    }

    // Validate response with Zod
    const validResponse = authResponseSchema.parse(response)

    return c.json(validResponse, 200)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid login data')
    }

    if (error instanceof AuthenticationError) {
      throw error
    }

    console.error('Login error:', error)
    throw new AuthenticationError('Login failed')
  }
})

// POST /auth/refresh - Token refresh
app.post('/refresh', async (c) => {
  try {
    // Parse and validate request body
    const rawData = await c.req.json()
    const validData = refreshTokenSchema.parse(rawData)

    // Verify refresh token
    const payload = await verifyRefreshToken(validData.refresh_token)

    // Get user to ensure they still exist and are active
    const user = await userQueries.findUserById(payload.sub)
    if (!user || !user.is_active) {
      throw new AuthenticationError('User not found or account disabled')
    }

    // Generate new tokens
    const tokenPayload = {
      sub: String(user.id),
      email: user.email,
      role: user.role
    }

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(tokenPayload),
      generateRefreshToken(tokenPayload)
    ])

    const { expiresIn } = getTokenExpiryTimes()

    const response = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer' as const,
      expires_in: expiresIn
    }

    return c.json(response, 200)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid refresh token request')
    }

    if (error instanceof AuthenticationError) {
      throw error
    }

    console.error('Refresh token error:', error)
    throw new AuthenticationError('Failed to refresh token')
  }
})

// GET /auth/me - Get current user profile (protected)
app.get('/me', authMiddleware, async (c) => {
  try {
    const userId = (c.get as any)('userId') as string

    if (!userId) {
      throw new AuthenticationError('User ID not found in token')
    }

    const user = await userQueries.findUserById(userId)
    if (!user) {
      throw new AuthenticationError('User not found')
    }

    // Return public user data
    const publicUser = publicUserSchema.parse(user)

    return c.json(publicUser, 200)
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }

    console.error('Get profile error:', error)
    throw new AuthenticationError('Failed to get user profile')
  }
})

// PUT /auth/me - Update current user profile (protected)
app.put('/me', requireAuth(), async (c) => {
  try {
    const userId = (c.get as any)('userId') as string
    const rawData = await c.req.json()

    // Basic validation for profile updates
    const updateSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().optional()
    })

    const validData = updateSchema.parse(rawData)

    if (Object.keys(validData).length === 0) {
      throw new ValidationError('No valid fields to update')
    }

    // Check if email is already taken by another user
    if (validData.email) {
      const existingUser = await userQueries.findUserByEmail(validData.email)
      if (existingUser && existingUser.id !== parseInt(userId)) {
        throw new ValidationError('Email already in use by another account')
      }
    }

    // Update user
    const updatedUser = await userQueries.updateUser(parseInt(userId), validData)

    return c.json({
      message: 'Profile updated successfully',
      user: updatedUser
    }, 200)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message
      }))
      throw new ValidationError('Invalid update data', fieldErrors)
    }

    if (error instanceof ValidationError) {
      throw error
    }

    console.error('Update profile error:', error)
    throw new Error('Failed to update profile')
  }
})

// POST /auth/logout - Logout (protected)
app.post('/logout', authMiddleware, async (c) => {
  // In a stateless JWT system, logout is mainly handled client-side
  // by removing the token. Here we can just acknowledge the logout.
  // In production, you might want to implement token blacklisting.

  return c.json({
    message: 'Logged out successfully'
  }, 200)
})

// GET /auth/users - Get all users (admin only)
app.get('/users', authMiddleware, authorize('admin'), async (c) => {
  try {
    const users = await userQueries.getAllUsers()
    const stats = await userQueries.getUserStats()

    return c.json({
      users,
      stats
    }, 200)
  } catch (error) {
    console.error('Get users error:', error)
    throw new Error('Failed to get users')
  }
})

export default app