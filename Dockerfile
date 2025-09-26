# Simple Dockerfile for MyCure Backend Assessment
FROM oven/bun:1.1.38-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run migrations and start the application
CMD ["sh", "-c", "bun run db:migrate && bun run src/index.ts"]