#!/bin/bash
set -e

echo "Running database migrations in Docker..."

# Check if container is running
if ! docker-compose ps | grep -q "mycure-api.*Up"; then
  echo "API container is not running. Starting services..."
  docker-compose up -d
  sleep 5
fi

# Run migrations
docker-compose exec -T api bun run db:migrate

# Check migration status
docker-compose exec -T api bun run --eval "
import { db } from './src/db/database';
try {
  const migrations = db.query('SELECT * FROM migrations ORDER BY executed_at DESC LIMIT 5').all();
  console.log('Recent migrations:', migrations);
} catch (error) {
  console.log('No migrations table found or error:', error.message);
}
"

echo "Migrations complete!"