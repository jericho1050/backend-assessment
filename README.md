# MyCure Backend Assessment

A RESTful API for task management with authentication and role-based access control.

## Setup

To install dependencies:

```sh
bun install
```

To setup database and create admin user:

```sh
bun run db:migrate
bun run create-admin
```

To run:

```sh
bun run dev
```

Server will be available at <http://localhost:3000>

## Database Commands

- `bun run db:migrate` - Run database migrations
- `bun run db:seed` - Seed database with sample tasks
- `bun run create-admin` - Create admin and test users

## Library Management Schema (Task 2.1)

This repository also includes a standalone Library Management System schema as part of Issue #3 deliverables:

- SQL file: [`src/db/migrations/003-library-schema.sql`](src/db/migrations/003-library-schema.sql) (standalone; not auto-applied)
- Docs: [`docs/library-schema.md`](docs/library-schema.md) (design decisions and index strategy)

Note: The schema is intentionally not wired into app migrations to avoid impacting the existing Task app tables.

## Library Complex Queries (Task 2.2)

The following complex queries accompany the library schema:

- SQL: [`src/db/queries/library-queries.sql`](src/db/queries/library-queries.sql)
- Docs: [`docs/library-queries.md`](docs/library-queries.md)

They include overdue books, popular books (6 months), user statistics, and a current-year revenue report.

## Library DB Integration (Task 2.3)

- Module: [`src/db/library.ts`](src/db/library.ts) (connection, retries, prepared statements, transactions)
- Docs: [`docs/library-db.md`](docs/library-db.md)

Notes:
- Uses SQLite via Bun; respects `LIB_DB_PATH` env var.
- Transactions implement availability checks and rollback-on-failure.

## Library Performance Optimization (Task 6.2)

- Performance Analysis: [`docs/library-performance.md`](docs/library-performance.md)
- Additional Indexes: [`src/db/migrations/004-library-performance-indexes.sql`](src/db/migrations/004-library-performance-indexes.sql)
- Optimized Queries: [`src/db/queries/library-optimized-queries.sql`](src/db/queries/library-optimized-queries.sql)

Key optimizations:
- Partial indexes for active borrowings and overdue books
- Materialized views for popular books and revenue reports
- N+1 query solutions with eager loading and batch patterns
- Full-text search capabilities for book discovery
- Archive strategies for historical data management

## Caching Strategy (Task 6.1)

- Module: [`src/utils/cache.ts`](src/utils/cache.ts) (in-memory TTL with pluggable interface)
- Integration: `GET /api/tasks`, `GET /api/tasks/:id` with parameterized keys
- Docs: [`docs/caching.md`](docs/caching.md)

Notes:
- `X-Cache: HIT|MISS` and `Cache-Control` headers added
- Short TTLs; item cache invalidated on update/delete

## API Endpoints

### Task Management (Public)

- `GET /api/tasks` - List all tasks with filtering, pagination, and search
- `GET /api/tasks/:id` - Get a specific task
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update user profile
- `POST /api/auth/logout` - Logout
- `GET /api/auth/users` - Get all users (admin only)

## Testing

Run tests:

```sh
bun test
```

Run tests in watch mode:

```sh
bun test:watch
```

### User Roles

The system implements three distinct user roles:

1. **Admin** - Full system access, can manage all resources
2. **User** - Standard authenticated user with limited privileges
3. **Guest** - Unauthenticated users with read-only access

### Authentication Middleware

#### `authMiddleware`

- Verifies JWT tokens from Authorization header or cookies
- Extracts user information and sets context variables
- Throws `AuthenticationError` for invalid/expired tokens

#### `authorize(...roles)`

- Checks if authenticated user has required role permissions
- Admins automatically bypass role restrictions
- Throws `ForbiddenError` for insufficient permissions

#### `checkTaskOwnership`

- Ensures users can only modify their own tasks
- Admins can override and access any task
- Validates task ownership via user_id foreign key

### How Authorization Works

#### **Guests (Unauthenticated)**

- [x] Can read tasks (GET endpoints)
- [ ] Cannot create, update, or delete tasks
- [ ] No access to user management

#### **Users (Authenticated)**

- [x] Can create new tasks (assigned to their user_id)
- [x] Can update/delete only their own tasks
- [x] Can view their own profile and update it
- [ ] Cannot access other users' tasks
- [ ] Cannot access admin endpoints

#### **Admins (Authenticated)**

- [x] Full access to all tasks regardless of ownership
- [x] Can manage all users via `/api/auth/users`
- [x] Can override task ownership restrictions
- [x] All user permissions plus administrative privileges

### Implementation Details

The role-based access control is implemented through a layered middleware approach:

```typescript
// Example protected route
app.post('/tasks',
  authMiddleware,                    // Verify JWT
  authorize(['admin', 'user']),      // Check roles
  checkTaskOwnership,                // Verify ownership
  async (c) => { /* handler */ }
)
```

### Security Features

- **JWT-based authentication** with 15-minute access tokens
- **Refresh tokens** with 7-day expiry for session management
- **Password hashing** using Bun's built-in bcrypt implementation
- **Role-based route protection** with middleware composition
- **Request correlation IDs** for audit trails
- **Comprehensive input validation** using Zod schemas

### Test Users

After running `bun run create-admin`, the following test accounts are available:

- **Admin**: `admin@example.com` / `admin123`
- **User**: `user@example.com` / `user123`

## Security Vulnerabilities Prevention (Task 7.1)

Comprehensive security documentation covering prevention strategies for common web application vulnerabilities:

- **SQL Injection Prevention**: Parameterized queries, input validation, ORM protection
- **XSS Prevention**: Output encoding, CSP headers, input sanitization
- **CSRF Prevention**: CSRF tokens, SameSite cookies, custom headers
- **Rate Limiting**: IP/user-based limits, progressive delays, DDoS protection
- **Password Security**: Strong hashing, complexity requirements, account lockout
- **Security Headers**: Comprehensive header implementation
- **Input Validation**: Zod schema validation strategies
- **Logging & Monitoring**: Security event logging and monitoring
- **Security Testing**: Automated security test methodologies
- **Vulnerability Assessment**: Regular security audit procedures

**Documentation**: [Security Vulnerabilities Prevention Guide](docs/security-vulnerabilities.md)

**Features Implemented**:
- [x] Parameterized queries with prepared statements
- [x] Input validation using Zod schemas
- [x] Password hashing with bcrypt (12 rounds)
- [x] JWT-based authentication with secure token handling
- [x] Role-based access control with middleware
- [x] Request correlation IDs for audit trails
- [x] Comprehensive error handling without information leakage

## API Security Implementation (Task 7.2)

Comprehensive security measures implemented for the Task Management API:

- **Rate Limiting**: IP and user-based limits with sliding window algorithm
- **Security Headers**: CSP, HSTS, X-Frame-Options, and other protective headers
- **CORS Configuration**: Environment-specific cross-origin request handling
- **Input Sanitization**: XSS and SQL injection prevention with pattern detection
- **Request Size Limits**: JSON, multipart, and header size validation
- **File Upload Validation**: Type, size, and extension validation with sanitization

**Documentation**: [API Security Implementation Guide](docs/api-security.md)

**Security Middleware**:
- [`src/middleware/rate-limit.ts`](src/middleware/rate-limit.ts) - Rate limiting with multiple configurations
- [`src/middleware/security-headers.ts`](src/middleware/security-headers.ts) - Comprehensive security headers
- [`src/middleware/cors.ts`](src/middleware/cors.ts) - CORS configuration with environment support
- [`src/middleware/input-sanitization.ts`](src/middleware/input-sanitization.ts) - Input validation and sanitization
- [`src/middleware/request-limits.ts`](src/middleware/request-limits.ts) - Request size and parameter limits

**Features Implemented**:
- [x] Rate limiting for auth endpoints (5 req/15min) and general endpoints (100 req/15min)
- [x] Security headers with environment-specific configurations
- [x] CORS with credential support and preflight handling
- [x] Input sanitization with SQL injection and XSS pattern detection
- [x] Request size limits (1MB JSON, 10MB multipart, 8KB headers)
- [x] File upload validation with type and size restrictions
- [x] Security event logging and monitoring
- [x] Environment-specific security configurations
