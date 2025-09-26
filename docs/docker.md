# Docker Setup Documentation

## Overview

This document provides comprehensive instructions for containerizing and deploying the MyCure Backend Assessment API using Docker and Kubernetes.

## Quick Start

### 1. Prerequisites
- Docker Engine 24.0+
- Docker Compose 2.20+
- Make (optional, for convenience commands)
- 4GB RAM minimum
- 10GB free disk space

### 2. Initial Setup

```bash
# Clone the repository
git clone https://github.com/jericho1050/backend-assessment.git
cd backend-assessment

# Copy environment template
cp .env.docker .env

# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Run database migrations
docker-compose exec api bun run db:migrate

# Create admin user
docker-compose exec api bun run create-admin
```

### 3. Access Services

- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **PostgreSQL** (optional): localhost:5432
- **Redis** (optional): localhost:6379
- **pgAdmin** (optional): http://localhost:5050
- **Redis Commander** (optional): http://localhost:8081

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Load Balancer │────▶│   API Container │────▶│   SQLite DB     │
│    (Nginx)      │     │   (Bun + Hono)  │     │                 │
│                 │     │                 │     └─────────────────┘
└─────────────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │   Monitoring    │
                        │ (Prometheus +   │
                        │   Grafana)      │
                        └─────────────────┘
```

## Container Details

### 1. Application Container

**Multi-stage Build Process:**

```dockerfile
# Stage 1: Dependencies (deps)
- Base: oven/bun:1.1.38-alpine
- Purpose: Install production dependencies
- Output: node_modules

# Stage 2: Builder
- Base: oven/bun:1.1.38-alpine
- Purpose: Compile TypeScript, build assets
- Output: Compiled application

# Stage 3: Production
- Base: oven/bun:1.1.38-alpine
- Purpose: Final runtime container
- Size: ~150MB
```

**Security Features:**
- Non-root user (nodejs:1001)
- Read-only filesystem (where possible)
- No shell or unnecessary tools
- Health checks enabled
- Resource limits enforced

### 2. Database Container

**SQLite Configuration:**
```yaml
api:
  environment:
    DATABASE_PATH: /app/data/mycure.db
  volumes:
    - api_data:/app/data
```

**Future PostgreSQL Support:**
```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: mycuredb
    POSTGRES_USER: mycureuser
    POSTGRES_PASSWORD: mycurepass
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

### 3. Redis Container (Optional)

**Redis Configuration:**
```yaml
redis:
  image: redis:7-alpine
  command: >
    redis-server
    --appendonly yes
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
    --requirepass secure-password
```

## Environment Variables

### Required Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment mode | development | production |
| `PORT` | API port | 3000 | 3000 |
| `DATABASE_PATH` | SQLite database path | /app/data/mycure.db | /app/data/mycure.db |
| `JWT_SECRET` | JWT signing key | - | random-256-bit-string |
| `JWT_REFRESH_SECRET` | Refresh token key | - | random-256-bit-string |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ALLOWED_ORIGINS` | CORS origins | http://localhost:3000 |
| `LOG_LEVEL` | Logging level | info |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | 900000 |
| `RATE_LIMIT_MAX` | Max requests per window | 100 |
| `MAX_REQUEST_SIZE` | Max request size (bytes) | 1048576 |
| `MAX_JSON_SIZE` | Max JSON size (bytes) | 1048576 |

## Docker Compose Commands

### Basic Operations

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove volumes (careful!)
docker-compose down -v

# Restart a specific service
docker-compose restart api

# View logs
docker-compose logs -f api

# Execute command in container
docker-compose exec api sh
```

### Using Make Commands

```bash
make build        # Build images
make up          # Start services
make down        # Stop services
make logs        # View logs
make shell       # Open API shell
make test        # Run tests
make migrate     # Run migrations
make seed        # Seed database
make create-admin # Create admin user
make clean       # Clean everything
make health      # Check API health
make status      # Show container status
```

### Production Commands

```bash
# Build production image
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start production stack
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scale API instances
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=3
```

### Optional Services

```bash
# Start with PostgreSQL
make postgres-up

# Start with Redis
make redis-up

# Start with admin tools
make tools-up

# Start with monitoring
make monitoring-up
```

## Deployment Strategies

### 1. Local Development

```bash
# Use development compose file
docker-compose -f docker-compose.yml up -d

# Enable hot reload
docker-compose exec api bun run dev
```

### 2. Production Deployment

```bash
# Build optimized image
docker build -t mycure-api:prod --target production .

# Use production compose override
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3. Kubernetes Deployment

```bash
# Build and push to registry
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/username/mycure-api:latest --push .

# Apply Kubernetes manifests
kubectl apply -f kubernetes/

# Check deployment status
kubectl get pods -l app=mycure-api
kubectl get svc mycure-api
```

## Monitoring and Observability

### 1. Enable Monitoring Stack

```bash
# Start with monitoring
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Access services
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)
```

### 2. Available Metrics

**Application Metrics:**
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `task_operations_total` - Task CRUD operations
- `auth_attempts_total` - Authentication attempts

**System Metrics:**
- CPU usage
- Memory consumption
- Disk I/O
- Network traffic

### 3. Grafana Dashboards

Import these dashboard IDs:
- **Node Exporter**: 1860
- **PostgreSQL**: 9628
- **Redis**: 11835
- **Docker**: 893

## Health Checks

### 1. Application Health

```bash
# Check API health
curl http://localhost:3000/api/health

# Response
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": "connected",
    "uptime": 3600,
    "memory": {
      "rss": 45678592,
      "heapTotal": 20971520,
      "heapUsed": 15728640
    },
    "version": "v20.10.0"
  }
}
```

### 2. Container Health

```bash
# Check container health status
docker-compose ps

# Detailed health info
docker inspect mycure-api --format='{{json .State.Health}}'
```

## Testing in Docker

### 1. Run Tests

```bash
# Run all tests
make test

# Or manually
docker-compose -f docker-compose.yml -f docker-compose.test.yml run test

# Run specific test file
docker-compose -f docker-compose.yml -f docker-compose.test.yml run test bun test src/tests/auth.test.ts
```

### 2. Test Environment

The test environment uses:
- In-memory SQLite database
- Test-specific environment variables
- Isolated container
- No external dependencies

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check if API container is running
docker-compose ps api

# Check API logs
docker-compose logs api

# Test database manually
docker-compose exec api bun run --eval "
import { db } from './src/db/database';
console.log('Database connected:', db.query('SELECT 1').get());
"
```

#### 2. Port Already in Use

```bash
# Change ports in .env file
PORT=3001

# Or stop conflicting services
sudo lsof -i :3000
kill -9 <PID>
```

#### 3. Permission Denied

```bash
# Fix permissions
sudo chown -R $(whoami):$(whoami) .
chmod +x scripts/*.sh
```

#### 4. Out of Memory

```bash
# Check memory usage
docker stats

# Increase limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G
```

#### 5. Build Failures

```bash
# Clean build cache
docker builder prune

# Rebuild without cache
docker-compose build --no-cache

# Check build logs
docker-compose build api
```

### Debug Mode

```bash
# Enable debug logging
docker-compose run -e LOG_LEVEL=debug api

# Interactive debugging
docker-compose run --rm api sh
> bun run src/index.ts
```

## Performance Tuning

### 1. Container Resources

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 2. Build Optimization

```dockerfile
# Use cache mounts for dependencies
RUN --mount=type=cache,target=/root/.bun \
    bun install --frozen-lockfile

# Multi-platform builds
docker buildx build --platform linux/amd64,linux/arm64 .
```

### 3. Database Optimization

```sql
-- SQLite optimizations
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 1000;
PRAGMA temp_store = MEMORY;
```

## Security Best Practices

### 1. Image Security

```bash
# Scan for vulnerabilities
docker scout cves mycure-api:latest

# Use specific versions, not latest
FROM oven/bun:1.1.38-alpine
# NOT: FROM oven/bun:latest
```

### 2. Runtime Security

```yaml
# docker-compose.yml
services:
  api:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    user: "1001:1001"
```

### 3. Secrets Management

```bash
# Use Docker secrets
echo "secret-password" | docker secret create jwt_secret -

# Reference in compose
services:
  api:
    secrets:
      - jwt_secret
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret
```

### 4. Network Isolation

```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true

services:
  api:
    networks:
      - frontend
      - backend
```

## CI/CD Integration

### GitHub Actions

The included workflow provides:
- Automated builds on push
- Multi-platform support (amd64, arm64)
- Push to GitHub Container Registry
- Automated testing
- Security scanning
- Version tagging

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - deploy

docker-build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

## Backup and Recovery

### 1. Database Backup

```bash
# Backup SQLite database
docker-compose exec api cp /app/data/mycure.db /app/data/mycure.db.backup

# Copy backup to host
docker cp $(docker-compose ps -q api):/app/data/mycure.db.backup ./mycure-backup.db

# Restore database
docker cp ./mycure-backup.db $(docker-compose ps -q api):/app/data/mycure.db
```

### 2. Volume Backup

```bash
# Backup all volumes
docker run --rm -v mycure-backend-assessment_api_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/api-backup.tar.gz /data

# Restore volumes
docker run --rm -v mycure-backend-assessment_api_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/api-backup.tar.gz -C /
```

## Scaling Strategies

### Horizontal Scaling

```bash
# Scale API containers
docker-compose up -d --scale api=5

# With load balancer
docker-compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
```

### Vertical Scaling

```yaml
# Increase resources
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 2G
```

## Maintenance

### Rolling Updates

```bash
# Build new image
docker build -t mycure-api:v2 .

# Update one container at a time
docker-compose up -d --no-deps --build api
```

### Database Migrations

```bash
# Run migrations in production
docker-compose exec api bun run db:migrate

# Check migration status
docker-compose exec api bun run --eval "
import { db } from './src/db/database';
const migrations = db.query('SELECT * FROM migrations ORDER BY executed_at DESC LIMIT 5').all();
console.log('Recent migrations:', migrations);
"
```

### Log Rotation

```yaml
# docker-compose.yml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        compress: "true"
```

## File Structure

```
.
├── Dockerfile                 # Production multi-stage build
├── Dockerfile.dev            # Development container
├── docker-compose.yml        # Main development stack
├── docker-compose.prod.yml   # Production overrides
├── docker-compose.test.yml   # Testing configuration
├── docker-compose.monitoring.yml # Monitoring stack
├── .dockerignore             # Build context optimization
├── .env.docker               # Environment template
├── Makefile                  # Convenience commands
├── scripts/
│   ├── docker-build.sh       # Build script
│   ├── docker-migrate.sh     # Migration script
│   └── docker-entrypoint.sh  # Custom entrypoint
├── kubernetes/
│   └── deployment.yaml       # K8s manifests
├── nginx/
│   └── nginx.conf            # Load balancer config
├── monitoring/
│   ├── prometheus.yml        # Prometheus config
│   └── grafana/              # Grafana configs
└── .github/workflows/
    └── docker.yml            # CI/CD pipeline
```

## Conclusion

This Docker setup provides a production-ready containerization solution with:
- **Multi-stage builds** for optimized images
- **Security best practices** implemented
- **Monitoring and observability** built-in
- **Scalability** through orchestration
- **Development workflow** optimization
- **CI/CD integration** ready

For production deployments, consider using Kubernetes or Docker Swarm for orchestration and managed services for databases.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Docker and Docker Compose logs
3. Check the GitHub Issues page
4. Consult the API documentation in `docs/`