import { Hono } from 'hono'
import { createTask, getTaskById, getTasks, updateTask, deleteTask } from '@/db/queries/tasks'
import { taskSchema, taskQuerySchema } from '@/validators/tasks'
import { ValidationError, NotFoundError } from '@/errors'

const app = new Hono()

app.get("/tasks", async (c) => {
    const query = c.req.query()
    try {
        const validQuery = taskQuerySchema.parse(query)
        const tasks = await getTasks(validQuery)
        return c.json(tasks)
    } catch (error) {
        // If validation fails, return empty array for invalid filters
        return c.json({ data: [], total: 0, page: 1, limit: 10, totalPages: 1 })
    }
})


app.get("/tasks/:id", async (c) => {
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


app.post("/tasks", async (c) => {
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

    // Use schema for full validation
    const validData = taskSchema.parse(data)
    await createTask(validData)
    return c.json({ message: "Task created successfully" }, 201)
})


app.put("/tasks/:id", async (c) => {
    const { id } = c.req.param()

    // Validate ID is numeric
    if (!id || isNaN(Number(id))) {
        throw new ValidationError('Invalid ID format')
    }

    // Check if task exists
    const existingTask = await getTaskById(id)
    if (!existingTask) {
        throw new NotFoundError('Task not found')
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

    // Create update object with existing values as defaults
    const updateData = {
        title: data.title || (existingTask as any).title,
        description: data.description || (existingTask as any).description,
        status: data.status || (existingTask as any).status,
        priority: data.priority || (existingTask as any).priority,
        due_date: data.due_date !== undefined ? data.due_date : (existingTask as any).due_date
    }

    // Validate the complete update data
    const validData = taskSchema.parse(updateData)
    await updateTask(id, validData)

    // Return the updated task
    const updatedTask = await getTaskById(id)
    return c.json(updatedTask)
})


app.delete("/tasks/:id", async (c) => {
    const { id } = c.req.param()

    // Validate ID is numeric
    if (!id || isNaN(Number(id))) {
        throw new ValidationError('Invalid ID format')
    }

    // Check if task exists
    const existingTask = await getTaskById(id)
    if (!existingTask) {
        throw new NotFoundError('Task not found')
    }

    await deleteTask(id)
    return c.json({ message: "Task deleted successfully" })
})

export default app
