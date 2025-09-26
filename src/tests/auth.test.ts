import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { createTestDatabase, seedTestData } from '@/db/test-database'

// Create test database before importing anything that uses db
const testDb = createTestDatabase()

// Mock the database module before importing app
mock.module('@/db/database', () => ({
    db: testDb
}))

import app from '@/index'

describe('Authentication API', () => {
    let authToken: string
    let refreshToken: string
    let adminToken: string
    let userToken: string

    beforeEach(() => {
        // Clear existing data and reset autoincrement
        testDb.query('DELETE FROM users').run()
        testDb.query('DELETE FROM sqlite_sequence WHERE name="users"').run()
        testDb.query('DELETE FROM tasks').run()
        testDb.query('DELETE FROM sqlite_sequence WHERE name="tasks"').run()

        // Reset tokens
        authToken = ''
        refreshToken = ''
        adminToken = ''
        userToken = ''
    })

    describe('POST /api/auth/register', () => {
        test('should register a new user successfully', async () => {
            const response = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'John Doe',
                    email: 'john@example.com',
                    password: 'password123'
                })
            })

            expect(response.status).toBe(201)
            const data = await response.json()
            expect(data).toHaveProperty('access_token')
            expect(data).toHaveProperty('refresh_token')
            expect(data.user).toHaveProperty('email', 'john@example.com')
            expect(data.user).toHaveProperty('name', 'John Doe')
            expect(data.user).toHaveProperty('role', 'user')
            expect(data.user).not.toHaveProperty('password_hash')
        })

        test('should reject registration with weak password', async () => {
            const response = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Jane Doe',
                    email: 'jane@example.com',
                    password: '123' // Too short
                })
            })

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data).toHaveProperty('error')
        })

        test('should reject duplicate email registration', async () => {
            // First registration
            await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'John Doe',
                    email: 'john@example.com',
                    password: 'password123'
                })
            })

            // Duplicate attempt
            const response = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Jane Doe',
                    email: 'john@example.com',
                    password: 'password456'
                })
            })

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('already registered')
        })

        test('should reject invalid email format', async () => {
            const response = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'John Doe',
                    email: 'invalid-email',
                    password: 'password123'
                })
            })

            expect(response.status).toBe(400)
        })

        test('should reject missing required fields', async () => {
            const response = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'john@example.com'
                    // Missing name and password
                })
            })

            expect(response.status).toBe(400)
        })
    })

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Register a test user first
            const registerResponse = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'John Doe',
                    email: 'john@example.com',
                    password: 'password123'
                })
            })
            const registerData = await registerResponse.json()
            authToken = registerData.access_token
            refreshToken = registerData.refresh_token
        })

        test('should login with valid credentials', async () => {
            const response = await app.request('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'john@example.com',
                    password: 'password123'
                })
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data).toHaveProperty('access_token')
            expect(data).toHaveProperty('refresh_token')
            expect(data.user).toHaveProperty('email', 'john@example.com')
            expect(data.message).toBe('Login successful')
        })

        test('should reject invalid email', async () => {
            const response = await app.request('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                })
            })

            expect(response.status).toBe(401)
            const data = await response.json()
            expect(data.error).toContain('Invalid email or password')
        })

        test('should reject invalid password', async () => {
            const response = await app.request('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'john@example.com',
                    password: 'wrongpassword'
                })
            })

            expect(response.status).toBe(401)
            const data = await response.json()
            expect(data.error).toContain('Invalid email or password')
        })

        test('should reject malformed requests', async () => {
            const response = await app.request('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'john@example.com'
                    // Missing password
                })
            })

            expect(response.status).toBe(400)
        })
    })

    describe('POST /api/auth/refresh', () => {
        beforeEach(async () => {
            // Register and login to get tokens
            const registerResponse = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'John Doe',
                    email: 'john@example.com',
                    password: 'password123'
                })
            })
            const data = await registerResponse.json()
            refreshToken = data.refresh_token
        })

        test('should refresh token with valid refresh token', async () => {
            const response = await app.request('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: refreshToken
                })
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data).toHaveProperty('access_token')
            expect(data).toHaveProperty('refresh_token')
            expect(data).toHaveProperty('token_type', 'Bearer')
            expect(data).toHaveProperty('expires_in')
        })

        test('should reject invalid refresh token', async () => {
            const response = await app.request('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: 'invalid_token'
                })
            })

            expect(response.status).toBe(401)
        })

        test('should reject missing refresh token', async () => {
            const response = await app.request('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })

            expect(response.status).toBe(400)
        })
    })

    describe('GET /api/auth/me', () => {
        beforeEach(async () => {
            // Register and get token
            const registerResponse = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'John Doe',
                    email: 'john@example.com',
                    password: 'password123'
                })
            })
            const data = await registerResponse.json()
            authToken = data.access_token
        })

        test('should return user profile with valid token', async () => {
            const response = await app.request('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data).toHaveProperty('email', 'john@example.com')
            expect(data).toHaveProperty('name', 'John Doe')
            expect(data).toHaveProperty('role', 'user')
            expect(data).not.toHaveProperty('password_hash')
        })

        test('should reject request without token', async () => {
            const response = await app.request('/api/auth/me')
            expect(response.status).toBe(401)
        })

        test('should reject request with invalid token', async () => {
            const response = await app.request('/api/auth/me', {
                headers: {
                    'Authorization': 'Bearer invalid_token'
                }
            })
            expect(response.status).toBe(401)
        })
    })

    describe('PUT /api/auth/me', () => {
        beforeEach(async () => {
            // Register and get token
            const registerResponse = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'John Doe',
                    email: 'john@example.com',
                    password: 'password123'
                })
            })
            const data = await registerResponse.json()
            authToken = data.access_token
        })

        test('should update user profile successfully', async () => {
            const response = await app.request('/api/auth/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: 'John Updated',
                    email: 'john.updated@example.com'
                })
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.user).toHaveProperty('name', 'John Updated')
            expect(data.user).toHaveProperty('email', 'john.updated@example.com')
        })

        test('should update only name', async () => {
            const response = await app.request('/api/auth/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: 'John Updated Only'
                })
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.user).toHaveProperty('name', 'John Updated Only')
            expect(data.user).toHaveProperty('email', 'john@example.com') // Unchanged
        })

        test('should reject empty update', async () => {
            const response = await app.request('/api/auth/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })

            expect(response.status).toBe(400)
        })

        test('should reject update without authentication', async () => {
            const response = await app.request('/api/auth/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'John Updated'
                })
            })

            expect(response.status).toBe(401)
        })
    })

    describe('POST /api/auth/logout', () => {
        beforeEach(async () => {
            // Register and get token
            const registerResponse = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'John Doe',
                    email: 'john@example.com',
                    password: 'password123'
                })
            })
            const data = await registerResponse.json()
            authToken = data.access_token
        })

        test('should logout successfully with valid token', async () => {
            const response = await app.request('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.message).toContain('Logged out successfully')
        })

        test('should reject logout without token', async () => {
            const response = await app.request('/api/auth/logout', {
                method: 'POST'
            })

            expect(response.status).toBe(401)
        })
    })

    describe('Role-Based Access Control', () => {
        beforeEach(async () => {
            // Create admin user
            const adminStmt = testDb.query(`
                INSERT INTO users (name, email, password_hash, role, is_active)
                VALUES (?, ?, ?, ?, ?)
                RETURNING *
            `)

            // Use a simple password hash for testing
            const passwordHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 4 })
            const adminUser = adminStmt.get('Admin User', 'admin@test.com', passwordHash, 'admin', 1)

            // Login as admin
            const adminLoginResponse = await app.request('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'admin@test.com',
                    password: 'admin123'
                })
            })
            const adminData = await adminLoginResponse.json()
            adminToken = adminData.access_token

            // Create regular user
            const userLoginResponse = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Regular User',
                    email: 'user@test.com',
                    password: 'user123'
                })
            })
            const userData = await userLoginResponse.json()
            userToken = userData.access_token
        })

        describe('GET /api/auth/users', () => {
            test('should allow admin to view all users', async () => {
                const response = await app.request('/api/auth/users', {
                    headers: {
                        'Authorization': `Bearer ${adminToken}`
                    }
                })

                expect(response.status).toBe(200)
                const data = await response.json()
                expect(data).toHaveProperty('users')
                expect(data).toHaveProperty('stats')
                expect(Array.isArray(data.users)).toBe(true)
            })

            test('should deny regular user access to user list', async () => {
                const response = await app.request('/api/auth/users', {
                    headers: {
                        'Authorization': `Bearer ${userToken}`
                    }
                })

                expect(response.status).toBe(403)
            })

            test('should deny unauthenticated access to user list', async () => {
                const response = await app.request('/api/auth/users')
                expect(response.status).toBe(401)
            })
        })

        test('should identify user roles correctly', async () => {
            // Check admin profile
            const adminProfileResponse = await app.request('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            })
            const adminProfile = await adminProfileResponse.json()
            expect(adminProfile.role).toBe('admin')

            // Check user profile
            const userProfileResponse = await app.request('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            })
            const userProfile = await userProfileResponse.json()
            expect(userProfile.role).toBe('user')
        })
    })

    describe('Security Features', () => {
        test('should hash passwords during registration', async () => {
            await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Security Test',
                    email: 'security@test.com',
                    password: 'plaintext123'
                })
            })

            // Check that password is hashed in database
            const userStmt = testDb.query('SELECT password_hash FROM users WHERE email = ?')
            const user = userStmt.get('security@test.com') as { password_hash: string }

            expect(user.password_hash).not.toBe('plaintext123')
            expect(user.password_hash).toMatch(/^\$2[aby]\$/) // bcrypt format
        })

        test('should validate JWT token structure', async () => {
            const registerResponse = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'JWT Test',
                    email: 'jwt@test.com',
                    password: 'password123'
                })
            })

            const data = await registerResponse.json()
            const tokenParts = data.access_token.split('.')

            // JWT should have 3 parts: header.payload.signature
            expect(tokenParts).toHaveLength(3)
        })

        test('should handle malformed Authorization headers', async () => {
            const response = await app.request('/api/auth/me', {
                headers: {
                    'Authorization': 'InvalidFormat'
                }
            })

            expect(response.status).toBe(401)
        })
    })
})