import { sign, verify } from 'hono/jwt'
import { authConfig } from '@/config/auth'
import { jwtPayloadSchema } from '@/validators/auth'
import type { JWTPayload } from '@/types/inferred'

// Using Bun's built-in password hashing
export const hashPassword = async (password: string): Promise<string> => {
  // Bun provides built-in bcrypt-compatible password hashing
  return await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: authConfig.bcryptRounds
  })
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await Bun.password.verify(password, hash)
  } catch (error) {
    return false
  }
}

export const generateAccessToken = async (payload: { sub: string; email: string; role: string }) => {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 15 * 60 // 15 minutes

  const tokenPayload = {
    ...payload,
    exp,
    iat: now,
    type: 'access' as const
  }

  // Validate payload with Zod
  jwtPayloadSchema.parse(tokenPayload)

  return await sign(tokenPayload, authConfig.jwtSecret)
}

export const generateRefreshToken = async (payload: { sub: string; email: string; role: string }) => {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 7 * 24 * 60 * 60 // 7 days

  const tokenPayload = {
    ...payload,
    exp,
    iat: now,
    type: 'refresh' as const
  }

  // Validate payload with Zod
  jwtPayloadSchema.parse(tokenPayload)

  return await sign(tokenPayload, authConfig.jwtRefreshSecret)
}

export const verifyAccessToken = async (token: string): Promise<JWTPayload> => {
  try {
    const payload = await verify(token, authConfig.jwtSecret)

    // Validate and parse with Zod
    return jwtPayloadSchema.parse(payload)
  } catch (error) {
    throw new Error('Invalid or expired access token')
  }
}

export const verifyRefreshToken = async (token: string): Promise<JWTPayload> => {
  try {
    const payload = await verify(token, authConfig.jwtRefreshSecret)

    // Validate and parse with Zod
    const validPayload = jwtPayloadSchema.parse(payload)

    // Ensure it's a refresh token
    if (validPayload.type !== 'refresh') {
      throw new Error('Invalid token type')
    }

    return validPayload
  } catch (error) {
    throw new Error('Invalid or expired refresh token')
  }
}

// Helper function to extract token from Authorization header
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null

  const parts = authHeader.trim().split(/\s+/)
  if (parts.length === 1) {
    // Token without scheme
    return parts[0]
  }
  if (parts.length >= 2) {
    const scheme = parts[0].toLowerCase()
    const token = parts.slice(1).join(' ')
    if ((scheme === 'bearer' || scheme === 'token') && token) {
      return token
    }
  }
  return null
}

// Helper function to calculate token expiry times
export const getTokenExpiryTimes = () => {
  const now = Math.floor(Date.now() / 1000)
  return {
    accessTokenExpiry: now + 15 * 60, // 15 minutes
    refreshTokenExpiry: now + 7 * 24 * 60 * 60, // 7 days
    expiresIn: 15 * 60 // 15 minutes in seconds
  }
}