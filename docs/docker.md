# Docker Deployment Guide

## Quick Start

### 1. Prerequisites
- Docker Engine 20.0+
- Docker Compose 2.0+

### 2. Deploy the Application

```bash
# Build and start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Run database migrations
docker-compose exec api bun run db:migrate

# Create admin user
docker-compose exec api bun run create-admin
```

### 3. Access the API

- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

## Basic Commands

```bash
# Start the application
docker-compose up -d

# Stop the application
docker-compose down

# View logs
docker-compose logs -f

# Run commands in the container
docker-compose exec api sh

# Rebuild and restart
docker-compose up -d --build
```

## Environment Variables

The application uses these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | production |
| `PORT` | API port | 3000 |
| `DATABASE_PATH` | SQLite database path | /app/data/mycure.db |
| `JWT_SECRET` | JWT signing key | your-secret-key-change-in-production |
| `JWT_REFRESH_SECRET` | Refresh token key | your-refresh-secret-change-in-production |

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the port in docker-compose.yml
2. **Database issues**: Check logs with `docker-compose logs api`
3. **Build failures**: Rebuild with `docker-compose build --no-cache`

### Health Check

```bash
# Check if the API is running
curl http://localhost:3000/api/health
```

## File Structure

```
.
├── Dockerfile          # Simple container build
├── docker-compose.yml  # Basic deployment config
├── .dockerignore       # Build optimization
└── .env.docker         # Environment template
```
