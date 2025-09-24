import { Database } from 'bun:sqlite'
import { runMigrations } from './migrate'

export const createTestDatabase = () => {
    // Create in-memory database for testing
    const testDb = new Database(':memory:')

    // Run migrations to set up schema
    runMigrations(testDb)

    return testDb
}

export const seedTestData = (database: Database) => {
    // Insert test data
    const insertStmt = database.query(`
        INSERT INTO tasks (id, title, description, status, priority, created_at, updated_at, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const testTasks = [
        {
            id: 1,
            title: 'Complete project documentation',
            description: 'Write comprehensive documentation for the API',
            status: 'pending',
            priority: 'high',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:00:00Z',
            due_date: '2024-01-15T18:00:00Z'
        },
        {
            id: 2,
            title: 'Fix authentication bug',
            description: 'Resolve login issues with OAuth integration',
            status: 'in_progress',
            priority: 'medium',
            created_at: '2024-01-02T09:30:00Z',
            updated_at: '2024-01-03T14:15:00Z',
            due_date: '2024-01-10T17:00:00Z'
        },
        {
            id: 3,
            title: 'Update dependencies',
            description: 'Upgrade all npm packages to latest versions',
            status: 'completed',
            priority: 'low',
            created_at: '2024-01-03T11:00:00Z',
            updated_at: '2024-01-04T16:30:00Z',
            due_date: '2024-01-20T12:00:00Z'
        },
        {
            id: 4,
            title: 'Database optimization',
            description: 'Optimize slow queries and add missing indexes',
            status: 'pending',
            priority: 'medium',
            created_at: '2024-01-04T13:45:00Z',
            updated_at: '2024-01-04T13:45:00Z',
            due_date: '2024-01-25T16:00:00Z'
        }
    ]

    // Insert each task
    for (const task of testTasks) {
        insertStmt.run(
            task.id,
            task.title,
            task.description,
            task.status,
            task.priority,
            task.created_at,
            task.updated_at,
            task.due_date
        )
    }

    return testTasks
}