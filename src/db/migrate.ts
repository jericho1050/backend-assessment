import { Database } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

export const runMigrations = (database: Database) => {
    // Create migrations table if it doesn't exist - using query() with .run() instead of exec
    const createMigrationsTableStmt = database.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE NOT NULL,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `)
    createMigrationsTableStmt.run()

    // Get list of executed migrations
    const executedQuery = database.query('SELECT filename FROM migrations')
    const executedMigrations = executedQuery.all() as { filename: string }[]
    const executedFilenames = new Set(executedMigrations.map(m => m.filename))

    // Get migration files from directory using import.meta.dirname for Node.js compatibility
    const migrationsDir = join(import.meta.dirname, 'migrations')
    const migrationFiles = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort()

    let applied = 0

    // Run pending migrations
    for (const filename of migrationFiles) {
        if (!executedFilenames.has(filename)) {
            console.log(`Applying migration: ${filename}`)

            const migrationPath = join(migrationsDir, filename)
            const migrationSQL = readFileSync(migrationPath, 'utf8')

            // Execute migration in a transaction using query().run() instead of exec
            const transaction = database.transaction(() => {
                const migrationStmt = database.query(migrationSQL)
                migrationStmt.run()
                database.query('INSERT INTO migrations (filename) VALUES (?)').run(filename)
            })

            transaction()
            applied++
        }
    }

    if (applied === 0) {
        console.log('No pending migrations')
    } else {
        console.log(`Applied ${applied} migration(s)`)
    }

    return applied
}