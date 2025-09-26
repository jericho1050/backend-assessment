import { Hono } from 'hono'
import { createTask, getTaskById, getTasks, updateTask, deleteTask } from '@/db/queries/tasks'
import {
  taskSchema,
  taskQuerySchema,
  createTaskSchema,
  updateTaskSchema,
  taskWithMetadataSchema
} from '@/validators/tasks'
import { ValidationError, NotFoundError, ForbiddenError } from '@/utils/errors'
import { optionalAuthMiddleware, requireAuth } from '@/middleware/auth'

const app = new Hono()

// GET /tasks - Public access with optional auth
app.get("/tasks", optionalAuthMiddleware, async (c) => {
    const query = c.req.query()

    // Be tolerant with query parsing; for invalid filters return empty dataset
    const parsed = taskQuerySchema.safeParse(query)
    if (!parsed.success) {
        return c.json({ data: [], total: 0, page: 1, limit: 10, totalPages: 1 })
    }

    const tasks = await getTasks(parsed.data as any)
    return c.json(tasks)
})

// GET /tasks/:id - Public access with optional auth
app.get("/tasks/:id", optionalAuthMiddleware, async (c) => {
    const { id } = c.req.param()

    // Validate ID is numeric
    if (!id || isNaN(Number(id))) {
        throw new ValidationError('Invalid ID format')
    }

    const task = await getTaskById(id)
    if (!task) {
        throw new NotFoundError('Task not found')
    }

    return c.json(task)
})


// POST /tasks - Require authentication (admin or user)
app.post("/tasks", requireAuth(['admin', 'user']), async (c) => {

    // Handle JSON parsing errors
    let data
    try {
        const contentType = c.req.header('content-type')
        if (!contentType || !contentType.includes('application/json')) {
            throw new ValidationError('Content-Type must be application/json')
        }
        data = await c.req.json()
    } catch (error) {
        if (error instanceof ValidationError) {
            throw error
        }
        throw new ValidationError('Invalid JSON format')
    }

    // Validate required fields
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new ValidationError('Request body must be an object')
    }

    // Check for missing required fields and provide specific error messages
    if (!data.title) {
        throw new ValidationError('Missing required field: title')
    }

    if (!data.description) {
        throw new ValidationError('Missing required field: description')
    }

    // Validate status if provided
    if (data.status && !['pending', 'in_progress', 'completed'].includes(data.status)) {
        throw new ValidationError('Invalid status value. Must be one of: pending, in_progress, completed')
    }

    // Validate priority if provided
    if (data.priority && !['low', 'medium', 'high'].includes(data.priority)) {
        throw new ValidationError('Invalid priority value. Must be one of: low, medium, high')
    }

    // Use schema for validation
    const validData = createTaskSchema.parse(data)

    // Assign to authenticated user
    const userId = (c.get as any)('userId') as string
    const taskData = {
        ...validData,
        user_id: parseInt(userId)
    }

    await createTask(taskData as any)
    return c.json({ message: "Task created successfully" }, 201)
})


// PUT /tasks/:id - Require authentication + ownership (admin can update any)
app.put("/tasks/:id", requireAuth(['admin', 'user']), async (c) => {
    const { id } = c.req.param()

    // Validate ID is numeric
    if (!id || isNaN(Number(id))) {
        throw new ValidationError('Invalid ID format')
    }

    // Check if task exists (already done in checkTaskOwnership middleware)
    const existingTask = await getTaskById(id)
    if (!existingTask) {
        throw new NotFoundError('Task not found')
    }

    // Enforce ownership
    const userId = (c.get as any)('userId') as string
    const userRole = (c.get as any)('userRole') as string

    const ownerId = (existingTask as any).user_id as number | null
    if (userRole !== 'admin') {
        if (ownerId === null || ownerId !== parseInt(userId)) {
            throw new ForbiddenError('You can only update your own tasks')
        }
    }

    // Handle JSON parsing errors
    let data
    try {
        const contentType = c.req.header('content-type')
        if (!contentType || !contentType.includes('application/json')) {
            throw new ValidationError('Content-Type must be application/json')
        }
        data = await c.req.json()
    } catch (error) {
        if (error instanceof ValidationError) {
            throw error
        }
        throw new ValidationError('Invalid JSON format')
    }

    // Validate request body is an object
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new ValidationError('Request body must be an object')
    }

    // Check if request body is empty
    if (Object.keys(data).length === 0) {
        throw new ValidationError('Request body cannot be empty')
    }

    // Validate status if provided
    if (data.status && !['pending', 'in_progress', 'completed'].includes(data.status)) {
        throw new ValidationError('Invalid status value. Must be one of: pending, in_progress, completed')
    }

    // Validate priority if provided
    if (data.priority && !['low', 'medium', 'high'].includes(data.priority)) {
        throw new ValidationError('Invalid priority value. Must be one of: low, medium, high')
    }

    // Use partial update schema for validation
    const validData = updateTaskSchema.parse(data)

    // Create update object with existing values as defaults
    const updateData = {
        title: validData.title || (existingTask as any).title,
        description: validData.description || (existingTask as any).description,
        status: validData.status || (existingTask as any).status,
        priority: validData.priority || (existingTask as any).priority,
        due_date: validData.due_date !== undefined ? validData.due_date : (existingTask as any).due_date
    }

    // Validate the complete update data
    const fullUpdateData = taskSchema.parse(updateData)
    await updateTask(id, { ...fullUpdateData, user_id: (existingTask as any).user_id })

    // Return the updated task
    const updatedTask = await getTaskById(id)
    return c.json(updatedTask)
})

// DELETE /tasks/:id - Require authentication + ownership (admin can delete any)
app.delete("/tasks/:id", requireAuth(['admin', 'user']), async (c) => {
    const { id } = c.req.param()

    // Validate ID is numeric
    if (!id || isNaN(Number(id))) {
        throw new ValidationError('Invalid ID format')
    }

    // Check if task exists (already done in checkTaskOwnership middleware)
    const existingTask = await getTaskById(id)
    if (!existingTask) {
        throw new NotFoundError('Task not found')
    }

    // Enforce ownership
    const userId = (c.get as any)('userId') as string
    const userRole = (c.get as any)('userRole') as string
    const ownerId = (existingTask as any).user_id as number | null
    if (userRole !== 'admin') {
        if (ownerId === null || ownerId !== parseInt(userId)) {
            throw new ForbiddenError('You can only delete your own tasks')
        }
    }

    await deleteTask(id)
    return c.json({ message: "Task deleted successfully" })
})

export default app
