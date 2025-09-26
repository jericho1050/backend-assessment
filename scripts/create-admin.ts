#!/usr/bin/env bun
import { db } from '@/db/database'
import { runMigrations } from '@/db/migrate'
import { hashPassword } from '@/utils/auth.utils'

const createAdmin = async () => {
  console.log('👤 Creating admin user...')

  // Ensure migrations are run first
  runMigrations(db)

  const email = 'admin@example.com'
  const password = 'admin123'
  const name = 'Admin User'

  try {
    // Check if admin already exists
    const existingAdmin = db.query('SELECT * FROM users WHERE email = ?').get(email)

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists with email:', email)
      console.log('🔑 Default credentials: admin@example.com / admin123')
      return
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create admin user
    const stmt = db.query(`
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id, name, email, role
    `)

    const result = stmt.get(name, email, passwordHash, 'admin', 1)

    if (!result) {
      throw new Error('Failed to create admin user')
    }

    console.log('✅ Admin user created successfully!')
    console.log('📧 Email:', email)
    console.log('🔐 Password:', password)
    console.log('🎯 Role: admin')
    console.log('')
    console.log('🚨 IMPORTANT: Change the default password after first login!')

    // Show user stats
    const totalUsers = db.query('SELECT COUNT(*) as count FROM users').get() as { count: number }
    const adminUsers = db.query('SELECT COUNT(*) as count FROM users WHERE role = "admin"').get() as { count: number }

    console.log('')
    console.log('📊 Database Stats:')
    console.log(`   Total users: ${totalUsers.count}`)
    console.log(`   Admin users: ${adminUsers.count}`)

  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      console.log('⚠️  Admin user already exists with email:', email)
      console.log('🔑 Default credentials: admin@example.com / admin123')
    } else {
      console.error('❌ Error creating admin user:', error)
      process.exit(1)
    }
  }
}

// Also create a regular test user
const createTestUser = async () => {
  console.log('\n👤 Creating test user...')

  const email = 'user@example.com'
  const password = 'user123'
  const name = 'Test User'

  try {
    // Check if user already exists
    const existingUser = db.query('SELECT * FROM users WHERE email = ?').get(email)

    if (existingUser) {
      console.log('⚠️  Test user already exists with email:', email)
      return
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create test user
    const stmt = db.query(`
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id, name, email, role
    `)

    const result = stmt.get(name, email, passwordHash, 'user', 1)

    if (!result) {
      throw new Error('Failed to create test user')
    }

    console.log('✅ Test user created successfully!')
    console.log('📧 Email:', email)
    console.log('🔐 Password:', password)
    console.log('🎯 Role: user')

  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      console.log('⚠️  Test user already exists with email:', email)
    } else {
      console.error('❌ Error creating test user:', error)
    }
  }
}

const main = async () => {
  console.log('🚀 Setting up users for testing...\n')

  await createAdmin()
  await createTestUser()

  console.log('\n🎉 User setup complete!')
  console.log('\n📝 Available test accounts:')
  console.log('   👑 Admin: admin@example.com / admin123')
  console.log('   👤 User:  user@example.com / user123')
  console.log('\n🌐 Use these credentials to test authentication in Postman!')
}

main().catch(console.error)
process.exit(0)