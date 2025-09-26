import { db } from "@/db/database"
import { Task, TaskQuery } from "@/types/inferred"
import { toIso } from "@/utils"

export const getTasks = async (query: TaskQuery) => {
    // pagination, sorting, filtering
    const { page = 1, limit = 10, sort = "created_at", status, priority, search } = query
    const sortable = new Set(["created_at", "updated_at", "priority", "due_date", "title", "status"])
    const orderBy = sortable.has(sort) ? sort : "created_at"

    const where: string[] = []
    const params: any[] = []

    if (status) {
        where.push("status = ?")
        params.push(status)
    }

    if (priority) {
        where.push("priority = ?")
        params.push(priority)
    }

    if (search) {
        where.push("title LIKE ? OR description LIKE ?")
        params.push(`%${search}%`, `%${search}%`)
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
    const offset = (page - 1) * limit


    const countStmt = db.query(`SELECT COUNT(*) as total FROM tasks ${whereSql}`)
    const { total } = countStmt.get(...params) as { total: number }

    const rowsStmt = db.query(`SELECT * FROM tasks ${whereSql} ORDER BY ${orderBy} DESC LIMIT ? OFFSET ?`)

    const rows = rowsStmt.all(...params, limit, offset) as Task[]

    const totalPages = Math.ceil(total / limit) || 1

    return { data: rows, total, page: Number(page), limit: Number(limit), totalPages }

}

export const getTaskById = async (id: string) => {
    const stmt = db.query("SELECT * FROM tasks WHERE id = ?")
    return stmt.get(id)
}

export const createTask = async (newTask: Task) => {

    const stmt = db.query(
        "INSERT INTO tasks (title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?)"
    )
    return stmt.run(
        newTask.title,
        newTask.description,
        newTask.status ?? 'pending',
        newTask.priority ?? 'medium',
        toIso(newTask.due_date)
    )
}

export const updateTask = async (id: string, updatedTask: Task) => {
    const stmt = db.query(
        "UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ? WHERE id = ?"
    )
    return stmt.run(
        updatedTask.title,
        updatedTask.description,
        updatedTask.status ?? 'pending',
        updatedTask.priority ?? 'medium',
        toIso(updatedTask.due_date),
        id
    )
}

export const deleteTask = async (id: string) => {
    const stmt = db.query("DELETE FROM tasks WHERE id = ?")
    return stmt.run(id)
}