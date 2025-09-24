import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { createTestDatabase, seedTestData } from '@/db/test-database'

// Create test database before importing anything that uses db
const testDb = createTestDatabase()

// Mock the database module before importing app
mock.module('@/db/database', () => ({
    db: testDb
}))

import app from '@/index'

describe('Tasks API', () => {
    beforeEach(() => {
        // Clear existing data and reset autoincrement using query().run()
        testDb.query('DELETE FROM tasks').run()
        testDb.query('DELETE FROM sqlite_sequence WHERE name="tasks"').run()

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

            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask)
            })

            expect(response.status).toBe(201)

            const data = await response.json()
            expect(data).toHaveProperty('id')
            expect(data.title).toBe(newTask.title)
            expect(data.description).toBe(newTask.description)
            expect(data.status).toBe(newTask.status)
            expect(data.priority).toBe(newTask.priority)
        })

        test("should create task with minimal required fields", async () => {
            const newTask = {
                title: 'Minimal task',
                description: 'Just title and description'
            }

            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask)
            })

            expect(response.status).toBe(201)

            const data = await response.json()
            expect(data.title).toBe(newTask.title)
            expect(data.description).toBe(newTask.description)
            expect(data.status).toBe('pending') // default value
            expect(data.priority).toBe('medium') // default value
        })

        test("should return 400 when title is missing", async () => {
            const invalidTask = {
                description: 'Missing title'
            }

            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidTask)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('priority')
        })

        test("should return 400 when request body is empty", async () => {
            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })

            expect(response.status).toBe(400)
        })

        test("should return 400 when Content-Type is not JSON", async () => {
            const response = await app.request('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: 'not json'
            })

            expect(response.status).toBe(400)
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

            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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

            const response = await app.request('/api/tasks/2', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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

            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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

            const response = await app.request('/api/tasks/999', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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

            const response = await app.request('/api/tasks/invalid-id', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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

            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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

            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidUpdate)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('priority')
        })

        test("should return 400 when request body is empty", async () => {
            const response = await app.request('/api/tasks/1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
        })
    })

    describe("DELETE /api/tasks/:id", () => {
        test("should delete a task successfully", async () => {
            const response = await app.request('/api/tasks/1', {
                method: 'DELETE'
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data).toHaveProperty('message')
            expect(data.message).toContain('deleted')
        })

        test("should return 404 for non-existent task ID", async () => {
            const response = await app.request('/api/tasks/999', {
                method: 'DELETE'
            })

            expect(response.status).toBe(404)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('not found')
        })

        test("should return 400 for invalid task ID format", async () => {
            const response = await app.request('/api/tasks/invalid-id', {
                method: 'DELETE'
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toHaveProperty('error')
            expect(data.error).toContain('Invalid ID')
        })

        test("should confirm task is actually deleted", async () => {
            // First delete the task
            const deleteResponse = await app.request('/api/tasks/3', {
                method: 'DELETE'
            })
            expect(deleteResponse.status).toBe(200)

            // Then try to get it - should return 404
            const getResponse = await app.request('/api/tasks/3')
            expect(getResponse.status).toBe(404)
        })
    })

})