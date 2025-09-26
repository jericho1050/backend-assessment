import { Database } from 'bun:sqlite'
import { runMigrations } from './migrate'

export const createTestDatabase = () => {
    // Create in-memory database for testing
    const testDb = new Database(':memory:')

    // Run migrations to set up schema
    runMigrations(testDb)

    // Verify that user_id column exists (debug)
    const taskTableInfo = testDb.query("PRAGMA table_info(tasks)").all()
    console.log('Task table structure:', taskTableInfo)

    return testDb
}

export const seedTestData = (database: Database) => {
    // First create test users
    const insertUserStmt = database.query(`
        INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // Create test users (password is 'test123' hashed)
    const testUsers = [
        {
            id: 1,
            name: 'Test Admin',
            email: 'admin@test.com',
            password_hash: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
            role: 'admin',
            is_active: 1,
            created_at: '2024-01-01T08:00:00Z',
            updated_at: '2024-01-01T08:00:00Z'
        },
        {
            id: 2,
            name: 'Test User',
            email: 'user@test.com',
            password_hash: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
            role: 'user',
            is_active: 1,
            created_at: '2024-01-01T08:00:00Z',
            updated_at: '2024-01-01T08:00:00Z'
        }
    ]

    // Insert test users
    for (const user of testUsers) {
        insertUserStmt.run(
            user.id,
            user.name,
            user.email,
            user.password_hash,
            user.role,
            user.is_active,
            user.created_at,
            user.updated_at
        )
    }

    // Insert test data
    const insertStmt = database.query(`
        INSERT INTO tasks (id, title, description, status, priority, created_at, updated_at, due_date, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            due_date: '2024-01-15T18:00:00Z',
            user_id: 2 // Assigned to test user
        },
        {
            id: 2,
            title: 'Fix authentication bug',
            description: 'Resolve login issues with OAuth integration',
            status: 'in_progress',
            priority: 'medium',
            created_at: '2024-01-02T09:30:00Z',
            updated_at: '2024-01-03T14:15:00Z',
            due_date: '2024-01-10T17:00:00Z',
            user_id: 1 // Assigned to admin
        },
        {
            id: 3,
            title: 'Update dependencies',
            description: 'Upgrade all npm packages to latest versions',
            status: 'completed',
            priority: 'low',
            created_at: '2024-01-03T11:00:00Z',
            updated_at: '2024-01-04T16:30:00Z',
            due_date: '2024-01-20T12:00:00Z',
            user_id: null // Legacy task without owner
        },
        {
            id: 4,
            title: 'Database optimization',
            description: 'Optimize slow queries and add missing indexes',
            status: 'pending',
            priority: 'medium',
            created_at: '2024-01-04T13:45:00Z',
            updated_at: '2024-01-04T13:45:00Z',
            due_date: '2024-01-25T16:00:00Z',
            user_id: 2 // Assigned to test user
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
            task.due_date,
            task.user_id
        )
    }

    return testTasks
}