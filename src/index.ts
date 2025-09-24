import { Hono } from 'hono'
import tasks from '@/routes/tasks'

const app = new Hono().basePath('/api')

app.route('/', tasks)


export default app
