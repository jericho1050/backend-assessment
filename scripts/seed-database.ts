#!/usr/bin/env bun
import { db } from '../src/db/database'
import { runMigrations } from '../src/db/migrate'

const seedData = () => {
    console.log('🌱 Seeding database...')

    // Ensure migrations are run first
    runMigrations(db)

    // Clear existing data
    console.log('🧹 Clearing existing data...')
    db.query('DELETE FROM tasks').run()
    db.query('DELETE FROM sqlite_sequence WHERE name="tasks"').run()

    // Insert seed data
    const insertStmt = db.query(`
        INSERT INTO tasks (title, description, status, priority, created_at, updated_at, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const seedTasks = [
        {
            title: 'Complete project documentation',
            description: 'Write comprehensive documentation for the API endpoints and database schema',
            status: 'pending',
            priority: 'high',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:00:00Z',
            due_date: '2024-02-15T18:00:00Z'
        },
        {
            title: 'Fix authentication bug',
            description: 'Resolve login issues with OAuth integration and improve error handling',
            status: 'in_progress',
            priority: 'high',
            created_at: '2024-01-02T09:30:00Z',
            updated_at: '2024-01-05T14:15:00Z',
            due_date: '2024-01-20T17:00:00Z'
        },
        {
            title: 'Update dependencies',
            description: 'Upgrade all npm packages to latest versions and test compatibility',
            status: 'completed',
            priority: 'low',
            created_at: '2024-01-03T11:00:00Z',
            updated_at: '2024-01-04T16:30:00Z',
            due_date: '2024-01-25T12:00:00Z'
        },
        {
            title: 'Database optimization',
            description: 'Optimize slow queries and add missing indexes for better performance',
            status: 'pending',
            priority: 'medium',
            created_at: '2024-01-04T13:45:00Z',
            updated_at: '2024-01-04T13:45:00Z',
            due_date: '2024-02-10T16:00:00Z'
        },
        {
            title: 'Implement user notifications',
            description: 'Add email and push notification system for task reminders',
            status: 'pending',
            priority: 'medium',
            created_at: '2024-01-05T15:20:00Z',
            updated_at: '2024-01-05T15:20:00Z',
            due_date: '2024-02-05T14:00:00Z'
        },
        {
            title: 'Setup CI/CD pipeline',
            description: 'Configure automated testing and deployment workflows',
            status: 'in_progress',
            priority: 'high',
            created_at: '2024-01-06T08:00:00Z',
            updated_at: '2024-01-08T11:30:00Z',
            due_date: '2024-01-30T12:00:00Z'
        },
        {
            title: 'Mobile app integration',
            description: 'Develop mobile app endpoints and sync functionality',
            status: 'pending',
            priority: 'low',
            created_at: '2024-01-07T16:45:00Z',
            updated_at: '2024-01-07T16:45:00Z',
            due_date: '2024-03-01T18:00:00Z'
        },
        {
            title: 'Security audit',
            description: 'Conduct comprehensive security review and vulnerability assessment',
            status: 'completed',
            priority: 'high',
            created_at: '2024-01-08T10:15:00Z',
            updated_at: '2024-01-10T09:00:00Z',
            due_date: '2024-01-15T17:00:00Z'
        }
    ]

    console.log(`📝 Inserting ${seedTasks.length} tasks...`)

    let inserted = 0
    for (const task of seedTasks) {
        try {
            insertStmt.run(
                task.title,
                task.description,
                task.status,
                task.priority,
                task.created_at,
                task.updated_at,
                task.due_date
            )
            inserted++
        } catch (error) {
            console.error(`❌ Failed to insert task: ${task.title}`, error)
        }
    }

    console.log(`✅ Successfully seeded ${inserted} tasks!`)
    console.log('🎉 Database seeding complete!')

    // Show a summary
    const totalTasks = db.query('SELECT COUNT(*) as count FROM tasks').get() as { count: number }
    console.log(`📊 Total tasks in database: ${totalTasks.count}`)
}

// Run the seeding function
seedData()
process.exit(0)