import { Hono } from 'hono'
import { getTasks } from '@/db/queries/tasks'

const app = new Hono()

app.get("/tasks", async (c) => {
    const query = c.req.query()
    const tasks = await getTasks(query)
    return c.json(tasks)
})

export default app
