# Security Vulnerabilities Prevention (Task 7.1)

## Overview

This document identifies common security vulnerabilities and provides prevention strategies with code examples for the Task Management API.

## 1. SQL Injection Prevention

### Vulnerability Description
SQL injection occurs when user input is directly concatenated into SQL queries, allowing attackers to execute malicious SQL commands.

### Vulnerable Code Example
```javascript
// ❌ VULNERABLE - Direct string concatenation
app.get('/tasks', (req, res) => {
  const userId = req.query.userId;
  const query = `SELECT * FROM tasks WHERE user_id = ${userId}`;
  db.query(query, (err, results) => {
    // Attacker can inject: ?userId=1; DROP TABLE tasks; --
  });
});
```

### Secure Implementation
```javascript
// ✅ SECURE - Parameterized queries
app.get('/tasks', (req, res) => {
  const userId = req.query.userId;
  const query = 'SELECT * FROM tasks WHERE user_id = ?';
  db.query(query, [userId], (err, results) => {
    // SQL injection prevented
  });
});

// ✅ SECURE - Using our existing implementation
import { getTasks } from '@/db/queries/tasks'

app.get("/tasks", async (c) => {
    const query = c.req.query()
    const parsed = taskQuerySchema.safeParse(query) // Input validation
    if (!parsed.success) {
        return c.json({ data: [], total: 0, page: 1, limit: 10, totalPages: 1 })
    }
    const tasks = await getTasks(parsed.data) // Uses prepared statements
    return c.json(tasks)
})
```

### Prevention Strategies
- **Parameterized Queries**: Always use prepared statements
- **Input Validation**: Validate and sanitize all inputs with Zod schemas
- **ORM Protection**: Use database abstraction layers
- **Database Permissions**: Restrict database user permissions
- **Query Logging**: Monitor and log all database queries

## 2. Cross-Site Scripting (XSS) Prevention

### Vulnerability Description
XSS allows attackers to inject malicious scripts into web pages viewed by other users.

### Vulnerable Code Example
```javascript
// ❌ VULNERABLE - Direct HTML output
app.get('/task/:id', (req, res) => {
  const task = getTaskById(req.params.id);
  res.send(`
    <h1>${task.title}</h1>
    <p>${task.description}</p>
    <!-- Attacker can inject: <script>alert('XSS')</script> -->
  `);
});
```

### Secure Implementation
```javascript
// ✅ SECURE - Output encoding and CSP headers
app.get('/task/:id', (req, res) => {
  const task = getTaskById(req.params.id);
  
  // Set security headers
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Encode output
  const safeTitle = escapeHtml(task.title);
  const safeDescription = escapeHtml(task.description);
  
  res.send(`
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
  `);
});

// ✅ SECURE - Our API implementation (JSON responses)
app.get("/tasks/:id", async (c) => {
    const { id } = c.req.param()
    
    // Input validation
    if (!id || isNaN(Number(id))) {
        throw new ValidationError('Invalid ID format')
    }
    
    const task = await getTaskById(id)
    if (!task) {
        throw new NotFoundError('Task not found')
    }
    
    // JSON responses are automatically escaped
    return c.json(task)
})
```

### Prevention Strategies
- **Input Sanitization**: Validate and sanitize all user inputs
- **Output Encoding**: Escape HTML, JavaScript, and CSS content
- **CSP Headers**: Implement Content Security Policy
- **HttpOnly Cookies**: Prevent JavaScript access to sensitive cookies
- **Template Engine**: Use auto-escaping template engines

## 3. Cross-Site Request Forgery (CSRF) Prevention

### Vulnerability Description
CSRF tricks users into performing unwanted actions on authenticated web applications.

### Vulnerable Code Example
```javascript
// ❌ VULNERABLE - No CSRF protection
app.post('/tasks', authenticateUser, (req, res) => {
  // Attacker can create a form on their site:
  // <form action="https://yourapp.com/tasks" method="POST">
  //   <input type="hidden" name="title" value="Malicious Task">
  // </form>
  // <script>document.forms[0].submit();</script>
  createTask(req.body);
  res.json({ success: true });
});
```

### Secure Implementation
```javascript
// ✅ SECURE - CSRF token validation
import { generateCSRFToken, validateCSRFToken } from '@/utils/csrf'

app.get('/csrf-token', (req, res) => {
  const token = generateCSRFToken(req.session.userId);
  res.json({ csrfToken: token });
});

app.post('/tasks', authenticateUser, validateCSRFToken, (req, res) => {
  createTask(req.body);
  res.json({ success: true });
});

// ✅ SECURE - SameSite cookie attribute
app.use(session({
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict' // Prevents CSRF
  }
}));

// ✅ SECURE - Custom header requirement
app.post('/tasks', authenticateUser, (req, res) => {
  // Require custom header that can't be set by browsers
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'CSRF protection' });
  }
  createTask(req.body);
  res.json({ success: true });
});
```

### Prevention Strategies
- **CSRF Tokens**: Generate and validate unique tokens per session
- **SameSite Cookies**: Use SameSite attribute for cookies
- **Origin Validation**: Check Origin/Referer headers
- **Custom Headers**: Require custom headers for state-changing operations
- **Double-Submit Cookies**: Use cookie-based CSRF protection

## 4. Rate Limiting and DDoS Protection

### Vulnerability Description
Without rate limiting, attackers can overwhelm the server with excessive requests.

### Vulnerable Code Example
```javascript
// ❌ VULNERABLE - No rate limiting
app.post('/auth/login', (req, res) => {
  // Attacker can make unlimited login attempts
  // Leading to brute force attacks and resource exhaustion
  authenticateUser(req.body);
});
```

### Secure Implementation
```javascript
// ✅ SECURE - Rate limiting middleware
import rateLimit from 'express-rate-limit'

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);

// ✅ SECURE - Progressive delay strategy
const progressiveDelay = (attempts) => {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
  return delay;
};

// ✅ SECURE - Redis-based distributed rate limiting
import { RedisRateLimit } from '@/utils/rate-limit'

const redisLimiter = new RedisRateLimit({
  redis: redisClient,
  keyPrefix: 'rate_limit:',
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(redisLimiter.middleware());
```

### Prevention Strategies
- **IP-based Rate Limiting**: Limit requests per IP address
- **User-based Rate Limiting**: Limit requests per authenticated user
- **Progressive Delays**: Increase delay with repeated violations
- **Distributed Rate Limiting**: Use Redis for multi-server environments
- **Resource Monitoring**: Monitor CPU, memory, and database connections
- **Load Balancer Integration**: Implement rate limiting at the load balancer level

## 5. Password Security Best Practices

### Vulnerability Description
Weak password handling can lead to account compromise and data breaches.

### Vulnerable Code Example
```javascript
// ❌ VULNERABLE - Plain text passwords
app.post('/auth/register', (req, res) => {
  const { email, password } = req.body;
  
  // Store password in plain text
  const user = {
    email,
    password, // Never do this!
    id: generateId()
  };
  
  saveUser(user);
  res.json({ success: true });
});
```

### Secure Implementation
```javascript
// ✅ SECURE - Strong password hashing
import { hashPassword, verifyPassword } from '@/utils/auth.utils'

app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  
  // Validate password strength
  if (!isStrongPassword(password)) {
    return res.status(400).json({ 
      error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' 
    });
  }
  
  // Hash password with bcrypt
  const passwordHash = await hashPassword(password);
  
  const user = {
    email,
    password_hash: passwordHash, // Store hash, not plain text
    id: generateId()
  };
  
  saveUser(user);
  res.json({ success: true });
});

// ✅ SECURE - Our existing implementation
export const hashPassword = async (password: string): Promise<string> => {
  return await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: authConfig.bcryptRounds // 12 rounds
  })
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await Bun.password.verify(password, hash)
  } catch (error) {
    return false
  }
}

// ✅ SECURE - Account lockout policy
const loginAttempts = new Map();

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const clientIP = req.ip;
  
  // Check for too many failed attempts
  const attempts = loginAttempts.get(`${email}:${clientIP}`) || 0;
  if (attempts >= 5) {
    return res.status(429).json({ 
      error: 'Too many failed attempts. Account locked for 15 minutes.' 
    });
  }
  
  const user = await findUserByEmail(email);
  if (!user || !await verifyPassword(password, user.password_hash)) {
    // Increment failed attempts
    loginAttempts.set(`${email}:${clientIP}`, attempts + 1);
    setTimeout(() => {
      loginAttempts.delete(`${email}:${clientIP}`);
    }, 15 * 60 * 1000); // 15 minutes
    
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Reset attempts on successful login
  loginAttempts.delete(`${email}:${clientIP}`);
  
  const token = generateJWT(user);
  res.json({ token });
});
```

### Prevention Strategies
- **Strong Hashing**: Use bcrypt, Argon2, or scrypt with appropriate cost factors
- **Salt Generation**: Use unique salts for each password
- **Password Complexity**: Enforce strong password requirements
- **Password History**: Prevent reuse of recent passwords
- **Account Lockout**: Implement progressive lockout policies
- **Secure Reset**: Use time-limited, single-use reset tokens
- **Multi-Factor Authentication**: Implement 2FA for enhanced security

## Security Headers Implementation

### Essential Security Headers
```javascript
// ✅ SECURE - Comprehensive security headers
app.use((req, res, next) => {
  // Prevent XSS attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self'"
  );
  
  // HTTPS enforcement
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Prevent information leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
});
```

## Input Validation Strategies

### Comprehensive Input Validation
```javascript
// ✅ SECURE - Zod schema validation
import { z } from 'zod'

const taskSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title too long')
    .regex(/^[a-zA-Z0-9\s\-_.,!?]+$/, 'Invalid characters in title'),
  description: z.string()
    .min(1, 'Description is required')
    .max(1000, 'Description too long'),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().datetime().optional()
});

app.post('/tasks', async (req, res) => {
  try {
    const validData = taskSchema.parse(req.body);
    const task = await createTask(validData);
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    throw error;
  }
});
```

## Logging and Monitoring Setup

### Security Event Logging
```javascript
// ✅ SECURE - Comprehensive security logging
import { logger } from '@/utils/logger'

const securityLogger = {
  logFailedLogin: (email, ip, userAgent) => {
    logger.warn('Failed login attempt', {
      email,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
      event: 'AUTH_FAILED'
    });
  },
  
  logSuspiciousActivity: (userId, activity, details) => {
    logger.error('Suspicious activity detected', {
      userId,
      activity,
      details,
      timestamp: new Date().toISOString(),
      event: 'SUSPICIOUS_ACTIVITY'
    });
  },
  
  logRateLimitExceeded: (ip, endpoint, attempts) => {
    logger.warn('Rate limit exceeded', {
      ip,
      endpoint,
      attempts,
      timestamp: new Date().toISOString(),
      event: 'RATE_LIMIT_EXCEEDED'
    });
  }
};

// Usage in middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log security-relevant events
    if (res.statusCode === 401) {
      securityLogger.logFailedLogin(req.body?.email, req.ip, req.get('User-Agent'));
    }
    
    if (res.statusCode === 429) {
      securityLogger.logRateLimitExceeded(req.ip, req.path, req.rateLimit?.attempts);
    }
    
    // Log all requests for monitoring
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
});
```

## Security Testing Methodologies

### Automated Security Testing
```javascript
// ✅ SECURE - Security test suite
import { describe, test, expect } from 'bun:test'

describe('Security Tests', () => {
  test('should prevent SQL injection', async () => {
    const maliciousInput = "1'; DROP TABLE tasks; --";
    const response = await app.request(`/api/tasks?userId=${encodeURIComponent(maliciousInput)}`);
    
    expect(response.status).toBe(400); // Should reject invalid input
    // Verify tasks table still exists
    const tasksResponse = await app.request('/api/tasks');
    expect(tasksResponse.status).toBe(200);
  });
  
  test('should prevent XSS in responses', async () => {
    const xssPayload = "<script>alert('xss')</script>";
    const response = await app.request('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: xssPayload, description: 'test' })
    });
    
    const task = await response.json();
    // JSON responses should escape HTML
    expect(task.title).not.toContain('<script>');
  });
  
  test('should enforce rate limiting', async () => {
    const promises = Array(10).fill().map(() => 
      app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
      })
    );
    
    const responses = await Promise.all(promises);
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
  
  test('should validate password strength', async () => {
    const weakPasswords = ['123', 'password', '12345678'];
    
    for (const password of weakPasswords) {
      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'test@test.com', 
          password,
          name: 'Test User'
        })
      });
      
      expect(response.status).toBe(400);
    }
  });
});
```

## Vulnerability Assessment Procedures

### Regular Security Audits
1. **Dependency Scanning**: Regularly scan for vulnerable dependencies
2. **Code Review**: Implement mandatory security code reviews
3. **Penetration Testing**: Conduct regular penetration tests
4. **Security Headers**: Verify all security headers are properly set
5. **Input Validation**: Test all input validation mechanisms
6. **Authentication**: Verify authentication and authorization flows
7. **Session Management**: Test session security and timeout policies
8. **Error Handling**: Ensure error messages don't leak sensitive information

### Security Monitoring Checklist
- [ ] Failed login attempts monitoring
- [ ] Unusual traffic patterns detection
- [ ] SQL injection attempt logging
- [ ] XSS attempt detection
- [ ] Rate limiting effectiveness
- [ ] Security header compliance
- [ ] Input validation coverage
- [ ] Authentication bypass attempts
- [ ] Privilege escalation attempts
- [ ] Data exfiltration monitoring

## Conclusion

Implementing these security measures provides comprehensive protection against common web application vulnerabilities. Regular security audits, monitoring, and testing ensure ongoing protection as the application evolves.
