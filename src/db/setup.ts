#!/usr/bin/env bun

import { db } from './database'
import { runMigrations } from './migrate'

console.log('Setting up database...')

try {
    // Run migrations
    runMigrations(db)

    console.log('Database setup completed successfully!')
} catch (error) {
    console.error('Database setup failed:', error)
    process.exit(1)
}