import { db } from '@/db/database'
import { userSchema, createUserSchema, publicUserSchema } from '@/validators/auth'
import type { User, RegisterDto, PublicUser, CreateUserDto, UpdateUserDto } from '@/types/inferred'
import { hashPassword } from '@/utils/auth.utils'

export const createUser = async (data: RegisterDto): Promise<PublicUser> => {
  const passwordHash = await hashPassword(data.password)

  const createData: CreateUserDto = {
    name: data.name,
    email: data.email,
    password_hash: passwordHash,
    role: 'user' // default role
  }

  // Validate input data with Zod
  createUserSchema.parse(createData)

  const stmt = db.query(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `)

  try {
    const result = stmt.get(
      createData.name,
      createData.email,
      createData.password_hash,
      createData.role
    )

    if (!result) {
      throw new Error('Failed to create user')
    }

    // Validate database result with Zod and return public user data
    const user = userSchema.parse(result)
    return publicUserSchema.parse(user)
  } catch (error) {
    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new Error('Email already registered')
    }
    throw error
  }
}

export const findUserByEmail = async (email: string): Promise<User | null> => {
  const stmt = db.query('SELECT * FROM users WHERE email = ? AND is_active = 1')
  const result = stmt.get(email)

  if (!result) {
    return null
  }

  // Validate database result with Zod
  return userSchema.parse(result)
}

export const findUserById = async (id: string | number): Promise<User | null> => {
  const stmt = db.query('SELECT * FROM users WHERE id = ? AND is_active = 1')
  const result = stmt.get(id)

  if (!result) {
    return null
  }

  // Validate database result with Zod
  return userSchema.parse(result)
}

export const findUserByIdIncludeInactive = async (id: string | number): Promise<User | null> => {
  const stmt = db.query('SELECT * FROM users WHERE id = ?')
  const result = stmt.get(id)

  if (!result) {
    return null
  }

  // Validate database result with Zod
  return userSchema.parse(result)
}

export const updateUserRole = async (userId: number, role: string): Promise<void> => {
  const stmt = db.query('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  const result = stmt.run(role, userId)

  if (result.changes === 0) {
    throw new Error('User not found or no changes made')
  }
}

export const updateUser = async (userId: number, updateData: UpdateUserDto): Promise<PublicUser> => {
  // Build dynamic query based on provided fields
  const fields = Object.keys(updateData).filter(key => updateData[key as keyof UpdateUserDto] !== undefined)

  if (fields.length === 0) {
    throw new Error('No fields to update')
  }

  const setClause = fields.map(field => `${field} = ?`).join(', ')
  const values = fields.map(field => updateData[field as keyof UpdateUserDto]).filter(v => v !== undefined)

  const stmt = db.query(`
    UPDATE users
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    RETURNING *
  `)

  const result = stmt.get(...values, userId)

  if (!result) {
    throw new Error('User not found')
  }

  // Validate database result with Zod and return public user data
  const user = userSchema.parse(result)
  return publicUserSchema.parse(user)
}

export const deactivateUser = async (userId: number): Promise<void> => {
  const stmt = db.query('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  const result = stmt.run(userId)

  if (result.changes === 0) {
    throw new Error('User not found')
  }
}

export const reactivateUser = async (userId: number): Promise<void> => {
  const stmt = db.query('UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  const result = stmt.run(userId)

  if (result.changes === 0) {
    throw new Error('User not found')
  }
}

export const getAllUsers = async (): Promise<PublicUser[]> => {
  const stmt = db.query('SELECT * FROM users ORDER BY created_at DESC')
  const results = stmt.all()

  // Validate each result with Zod and convert to public user data
  return results.map(result => {
    const user = userSchema.parse(result)
    return publicUserSchema.parse(user)
  })
}

export const getUserStats = async () => {
  const totalStmt = db.query('SELECT COUNT(*) as total FROM users')
  const activeStmt = db.query('SELECT COUNT(*) as active FROM users WHERE is_active = 1')
  const adminStmt = db.query('SELECT COUNT(*) as admins FROM users WHERE role = "admin"')

  const { total } = totalStmt.get() as { total: number }
  const { active } = activeStmt.get() as { active: number }
  const { admins } = adminStmt.get() as { admins: number }

  return {
    total,
    active,
    inactive: total - active,
    admins
  }
}