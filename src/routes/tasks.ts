import { Hono } from 'hono'
import { createTask, getTaskById, getTasks } from '@/db/queries/tasks'

const app = new Hono()

app.get("/tasks", async (c) => {
    const query = c.req.query()
    const tasks = await getTasks(query)
    return c.json(tasks)
})


app.get("/tasks/:id", async (c) => {
    const { id } = c.req.param()
    const task = await getTaskById(id)
    return c.json(task)
})


app.post("/tasks", async (c) => {
    const data = await c.req.json()
    await createTask(data)
    return c.json({ message: "Task created successfully" }, 201)
})

export default app
