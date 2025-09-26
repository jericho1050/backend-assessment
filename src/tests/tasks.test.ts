import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { createTestDatabase, seedTestData } from '@/db/test-database'
import { generateAccessToken } from '@/utils/auth.utils'

// Create test database before importing anything that uses db
const testDb = createTestDatabase()

// Mock the database module before importing app
mock.module('@/db/database', () => ({
    db: testDb
}))

import app from '@/index'

// Helper functions for authenticated requests
const createAuthHeaders = async (userId: string, email: string, role: string) => {
    const token = await generateAccessToken({ sub: userId, email, role })
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
}

const createAdminHeaders = async () => {
    return await createAuthHeaders('1', 'admin@test.com', 'admin')
}

const createUserHeaders = async () => {
    return await createAuthHeaders('2', 'user@test.com', 'user')
}

describe('Tasks API', () => {
    beforeEach(() => {
        // Clear existing data and reset autoincrement using query().run()
        testDb.query('DELETE FROM tasks').run()
        testDb.query('DELETE FROM users').run()
        testDb.query('DELETE FROM sqlite_sequence WHERE name="tasks"').run()
        testDb.query('DELETE FROM sqlite_sequence WHERE name="users"').run()

        // Seed fresh test data for each test
        seedTestData(testDb)
    })
    describe("GET /api/tasks", () => {
        test("should return all tasks with pagination", async () => {
            const response = await app.request('/api/tasks')
            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data).toHaveProperty('data')
            expect(data).toHaveProperty('total')
            expect(data).toHaveProperty('page')
            expect(data).toHaveProperty('limit')
            expect(data).toHaveProperty('totalPages')
            expect(Array.isArray(data.data)).toBe(true)
        })

        test("should handle pagination parameters", async () => {
            const response = await app.request('/api/tasks?page=2&limit=2')
            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data.page).toBe(2)
            expect(data.limit).toBe(2)
        })

        test("should filter tasks by status", async () => {
            const response = await app.request('/api/tasks?status=pending')
            expect(response.status).toBe(200)

            const data = await response.json()
            data.data.forEach((task: any) => {
                expect(task.status).toBe('pending')
            })
        })

        test("should filter tasks by priority", async () => {
            const response = await app.request('/api/tasks?priority=high')
            expect(response.status).toBe(200)

            const data = await response.json()
            data.data.forEach((task: any) => {
                expect(task.priority).toBe('high')
            })
        })

        test("should search tasks by title and description", async () => {
            const response = await app.request('/api/tasks?search=documentation')
            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data.data.length).toBeGreaterThan(0)
        })

        test("should sort tasks by created_at ascending", async () => {
            const response = await app.request('/api/tasks?sort=created_at&order=asc')
            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data.data.length).toBeGreaterThan(0)
        })

        test("should sort tasks by priority descending", async () => {
            const response = await app.request('/api/tasks?sort=priority&order=desc')
            expect(response.status).toBe(200)
        })

        test("should handle combined filters", async () => {
            const response = await app.request('/api/tasks?status=pending&priority=medium&page=1&limit=5')
            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data.page).toBe(1)
            expect(data.limit).toBe(5)
        })

        test("should return empty array when no tasks match filters", async () => {
            const response = await app.request('/api/tasks?status=nonexistent')
            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data.data).toEqual([])
            expect(data.total).toBe(0)
        })
    })

    describe("POST /api/tasks", () => {
        test("should create a new task successfully", async () => {
            const newTask = {
                title: 'New test task',
                description: 'This is a test task description',
                status: 'pending',
                priority: 'medium',
                due_date: '2024-01-30T18:00:00Z'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers,
                body: JSON.stringify(newTask)
            })

            expect(response.status).toBe(201)

            const data = await response.json()
            expect(data).toHaveProperty('message')
            expect(data.message).toBe('Task created successfully')
        })

        test("should create task with minimal required fields", async () => {
            const newTask = {
                title: 'Minimal task',
                description: 'Just title and description'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers,
                body: JSON.stringify(newTask)
            })

            expect(response.status).toBe(201)

            const data = await response.json()
            expect(data).toHaveProperty('message')
            expect(data.message).toBe('Task created successfully')
        })

        test("should return 400 when title is missing", async () => {
            const invalidTask = {
                description: 'Missing title'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers,
                body: JSON.stringify(invalidTask)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('title')
        })

        test("should return 400 when description is missing", async () => {
            const invalidTask = {
                title: 'Missing description'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers,
                body: JSON.stringify(invalidTask)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('description')
        })

        test("should return 400 when status is invalid", async () => {
            const invalidTask = {
                title: 'Test task',
                description: 'Test description',
                status: 'invalid_status'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers,
                body: JSON.stringify(invalidTask)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('status')
        })

        test("should return 400 when priority is invalid", async () => {
            const invalidTask = {
                title: 'Test task',
                description: 'Test description',
                priority: 'invalid_priority'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers,
                body: JSON.stringify(invalidTask)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('priority')
        })

        test("should return 400 when request body is empty", async () => {
            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            })

            expect(response.status).toBe(400)
        })

        test("should return 400 when Content-Type is not JSON", async () => {
            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'text/plain' },
                body: 'not json'
            })

            expect(response.status).toBe(400)
        })

        test("should create task and assign to authenticated user", async () => {
            const headers = await createUserHeaders()
            const newTask = {
                title: 'Authenticated user task',
                description: 'This task should be assigned to the authenticated user'
            }

            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers,
                body: JSON.stringify(newTask)
            })

            expect(response.status).toBe(201)

            // Verify task was created with user_id
            const tasksResponse = await app.request('/api/tasks')
            const tasks = await tasksResponse.json()
            const createdTask = tasks.data.find((t: any) => t.title === newTask.title)
            expect(createdTask).toBeDefined()
            expect(createdTask.user_id).toBe(2) // Test user ID
        })

        test("should create task and assign to authenticated admin", async () => {
            const headers = await createAdminHeaders()
            const newTask = {
                title: 'Admin task',
                description: 'This task should be assigned to the admin'
            }

            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers,
                body: JSON.stringify(newTask)
            })

            expect(response.status).toBe(201)

            // Verify task was created with admin user_id
            const tasksResponse = await app.request('/api/tasks')
            const tasks = await tasksResponse.json()
            const createdTask = tasks.data.find((t: any) => t.title === newTask.title)
            expect(createdTask).toBeDefined()
            expect(createdTask.user_id).toBe(1) // Admin user ID
        })
    })

    describe("GET /api/tasks/:id", () => {
        test("should return a single task by ID", async () => {
            const response = await app.request('/api/tasks/1')
            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data).toHaveProperty('id', 1)
            expect(data).toHaveProperty('title')
            expect(data).toHaveProperty('description')
            expect(data).toHaveProperty('status')
            expect(data).toHaveProperty('priority')
            expect(data).toHaveProperty('created_at')
            expect(data).toHaveProperty('updated_at')
        })

        test("should return 404 for non-existent task ID", async () => {
            const response = await app.request('/api/tasks/999')
            expect(response.status).toBe(404)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('not found')
        })

        test("should return 400 for invalid task ID format", async () => {
            const response = await app.request('/api/tasks/invalid-id')
            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('Invalid ID')
        })
    })

    describe("PUT /api/tasks/:id", () => {
        test("should update a task successfully", async () => {
            const updateData = {
                title: 'Updated task title',
                description: 'Updated task description',
                status: 'in_progress',
                priority: 'high'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers,
                body: JSON.stringify(updateData)
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data).toHaveProperty('id', 1)
            expect(data.title).toBe(updateData.title)
            expect(data.description).toBe(updateData.description)
            expect(data.status).toBe(updateData.status)
            expect(data.priority).toBe(updateData.priority)
            expect(data).toHaveProperty('updated_at')
        })

        test("should allow partial updates", async () => {
            const partialUpdate = {
                status: 'completed'
            }

            // Task 2 belongs to admin; use admin token for partial update
            const headers = await createAdminHeaders()
            const response = await app.request('/api/tasks/2', {
                method: 'PUT',
                headers,
                body: JSON.stringify(partialUpdate)
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data.status).toBe('completed')
            expect(data).toHaveProperty('id', 2)
        })

        test("should update only priority", async () => {
            const priorityUpdate = {
                priority: 'low'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers,
                body: JSON.stringify(priorityUpdate)
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data.priority).toBe('low')
        })

        test("should return 404 for non-existent task ID", async () => {
            const updateData = {
                title: 'Updated title'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks/999', {
                method: 'PUT',
                headers,
                body: JSON.stringify(updateData)
            })

            expect(response.status).toBe(404)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('not found')
        })

        test("should return 400 for invalid task ID format", async () => {
            const updateData = {
                title: 'Updated title'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks/invalid-id', {
                method: 'PUT',
                headers,
                body: JSON.stringify(updateData)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('Invalid ID')
        })

        test("should return 400 for invalid status value", async () => {
            const invalidUpdate = {
                status: 'invalid_status'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers,
                body: JSON.stringify(invalidUpdate)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('status')
        })

        test("should return 400 for invalid priority value", async () => {
            const invalidUpdate = {
                priority: 'invalid_priority'
            }

            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers,
                body: JSON.stringify(invalidUpdate)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('priority')
        })

        test("should return 400 when request body is empty", async () => {
            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers,
                body: JSON.stringify({})
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
        })

        test("should allow user to update own task", async () => {
            const headers = await createUserHeaders()
            const updateData = {
                title: 'Updated by owner',
                status: 'completed'
            }

            // Task 1 belongs to user ID 2 (test user)
            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers,
                body: JSON.stringify(updateData)
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.title).toBe(updateData.title)
            expect(data.status).toBe(updateData.status)
        })

        test("should prevent user from updating another user's task", async () => {
            const headers = await createUserHeaders()
            const updateData = {
                title: 'Trying to update admin task'
            }

            // Task 2 belongs to admin (user ID 1), test user shouldn't be able to update it
            const response = await app.request('/api/tasks/2', {
                method: 'PUT',
                headers,
                body: JSON.stringify(updateData)
            })

            expect(response.status).toBe(403)
            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('own tasks')
        })

        test("should allow admin to update any task", async () => {
            const headers = await createAdminHeaders()
            const updateData = {
                title: 'Admin can update anything',
                status: 'in_progress'
            }

            // Task 1 belongs to regular user, but admin should be able to update it
            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers,
                body: JSON.stringify(updateData)
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.title).toBe(updateData.title)
        })

        test("should allow updating legacy task without owner", async () => {
            const headers = await createUserHeaders()
            const updateData = {
                title: 'Updated legacy task'
            }

            // Task 3 has user_id = null (legacy task) – now disallowed for non-admin
            const response = await app.request('/api/tasks/3', {
                method: 'PUT',
                headers,
                body: JSON.stringify(updateData)
            })

            expect(response.status).toBe(403)
            const data = await response.json()
            expect(data).toHaveProperty('error')
        })
    })

    describe("DELETE /api/tasks/:id", () => {
        test("should delete a task successfully", async () => {
            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks/1', {
                method: 'DELETE',
                headers
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data).toHaveProperty('message')
            expect(data.message).toContain('deleted')
        })

        test("should return 404 for non-existent task ID", async () => {
            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks/999', {
                method: 'DELETE',
                headers
            })

            expect(response.status).toBe(404)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('not found')
        })

        test("should return 400 for invalid task ID format", async () => {
            const headers = await createUserHeaders()
            const response = await app.request('/api/tasks/invalid-id', {
                method: 'DELETE',
                headers
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('Invalid ID')
        })

        test("should confirm task is actually deleted", async () => {
            // First delete the task
            // Legacy task without owner: only admin can delete in strict RBAC
            const headers = await createAdminHeaders()
            const deleteResponse = await app.request('/api/tasks/3', {
                method: 'DELETE',
                headers
            })
            expect(deleteResponse.status).toBe(200)

            // Then try to get it - should return 404
            const getResponse = await app.request('/api/tasks/3')
            expect(getResponse.status).toBe(404)
        })

        test("should allow user to delete own task", async () => {
            const headers = await createUserHeaders()

            // Task 1 belongs to user ID 2 (test user)
            const response = await app.request('/api/tasks/1', {
                method: 'DELETE',
                headers
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.message).toContain('deleted')

            // Verify task is actually deleted
            const getResponse = await app.request('/api/tasks/1')
            expect(getResponse.status).toBe(404)
        })

        test("should prevent user from deleting another user's task", async () => {
            const headers = await createUserHeaders()

            // Task 2 belongs to admin (user ID 1), test user shouldn't be able to delete it
            const response = await app.request('/api/tasks/2', {
                method: 'DELETE',
                headers
            })

            expect(response.status).toBe(403)
            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('own tasks')
        })

        test("should allow admin to delete any task", async () => {
            const headers = await createAdminHeaders()

            // Task 4 belongs to regular user, but admin should be able to delete it
            const response = await app.request('/api/tasks/4', {
                method: 'DELETE',
                headers
            })

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.message).toContain('deleted')
        })

        test("should allow deleting legacy task without owner", async () => {
            const headers = await createUserHeaders()

            // Task 3 has user_id = null (legacy task) – now disallowed for non-admin
            const response = await app.request('/api/tasks/3', {
                method: 'DELETE',
                headers
            })

            expect(response.status).toBe(403)
            const data = await response.json()
            expect(data).toHaveProperty('error')
        })
    })

})