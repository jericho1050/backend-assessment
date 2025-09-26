# ===============================================
# Dockerfile
# Multi-stage build for production-ready container
# ===============================================

# Stage 1: Dependencies
FROM oven/bun:1.1.38-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install production dependencies
RUN bun install --frozen-lockfile --production

# ===============================================
# Stage 2: Build
FROM oven/bun:1.1.38-alpine AS builder
WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Build the application (if needed)
# RUN bun build ./src/index.ts --target=bun --outdir=./dist

# ===============================================
# Stage 3: Production
FROM oven/bun:1.1.38-alpine AS production
WORKDIR /app

# Install necessary packages for health checks and debugging
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tzdata

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs package.json ./
COPY --chown=nodejs:nodejs tsconfig.json ./
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs scripts ./scripts

# Create directory for SQLite database
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Run database migrations and start the application
CMD ["sh", "-c", "bun run db:migrate && bun run src/index.ts"]