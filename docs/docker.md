# Docker Deployment Guide

## Quick Start

### 1. Prerequisites
- Docker Engine 20.0+

### 2. Deploy the Application

```bash
# Build the Docker image
docker build -t mycure-backend .

# Run the container
docker run -d -p 3000:3000 --name mycure-api mycure-backend

# View logs
docker logs -f mycure-api

# Create admin user (optional)
docker exec mycure-api bun run create-admin
```

### 3. Access the API

- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

## Basic Commands

```bash
# Build the image
docker build -t mycure-backend .

# Run the container
docker run -d -p 3000:3000 --name mycure-api mycure-backend

# Stop the container
docker stop mycure-api

# Remove the container
docker rm mycure-api

# View logs
docker logs -f mycure-api

# Run commands in the container
docker exec -it mycure-api sh

# Rebuild and restart
docker stop mycure-api && docker rm mycure-api
docker build -t mycure-backend .
docker run -d -p 3000:3000 --name mycure-api mycure-backend
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

1. **Port already in use**: Change the port in the docker run command (e.g., `-p 3001:3000`)
2. **Database issues**: Check logs with `docker logs mycure-api`
3. **Build failures**: Rebuild with `docker build --no-cache -t mycure-backend .`

### Health Check

```bash
# Check if the API is running
curl http://localhost:3000/api/health
```

## File Structure

```
.
├── Dockerfile          # Container build configuration
├── .dockerignore       # Build optimization
└── env.docker          # Environment template
```
