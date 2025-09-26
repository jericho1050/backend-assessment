#!/bin/sh
set -e

echo "Starting MyCure Backend Assessment API..."

# Wait for any external dependencies (if using PostgreSQL/Redis in future)
# if [ -n "$DATABASE_URL" ]; then
#   echo "Waiting for PostgreSQL..."
#   while ! nc -z postgres 5432; do
#     sleep 1
#   done
#   echo "PostgreSQL is ready!"
# fi

# if [ -n "$REDIS_URL" ]; then
#   echo "Waiting for Redis..."
#   while ! nc -z redis 6379; do
#     sleep 1
#   done
#   echo "Redis is ready!"
# fi

# Run migrations
echo "Running database migrations..."
bun run db:migrate

# Create admin user if not exists
if [ "$CREATE_ADMIN_ON_START" = "true" ]; then
  echo "Creating admin user..."
  bun run create-admin
fi

# Start the application
echo "Starting application..."
exec bun run src/index.ts