## Bonus Section: Real-World Scenario (Optional - 20 minutes)

### Crisis Scenario
You're working on a production API that suddenly starts receiving 500 errors for 20% of requests. The errors are related to database timeouts.

**Investigation & Response Plan:**

### 1. What steps would you take to investigate?

**Immediate Assessment:**
- Check application and database server health metrics
- Analyze error logs for timeout patterns and affected queries
- Monitor database connection pool status and active connections
- Review recent deployments or configuration changes
- Check database performance metrics (CPU, memory, disk I/O)
- Analyze slow query logs to identify problematic queries

**Deep Dive Investigation:**
- Examine query execution plans for performance regressions
- Check for database locks and blocking transactions  
- Monitor connection pool exhaustion patterns
- Analyze API endpoint usage patterns for traffic spikes
- Review application code changes for inefficient queries
- Check database server resources and capacity limits

### 2. What immediate actions would you implement?

**Emergency Response:**
- Implement circuit breaker to fail fast on timeout-prone endpoints
- Increase database connection timeout temporarily
- Scale up database connection pool size if possible
- Enable query caching for frequently accessed data
- Implement API rate limiting to reduce database load
- Set up temporary read replicas if available

**Traffic Management:**
- Redirect non-critical traffic to maintenance mode
- Prioritize critical user operations
- Implement graceful degradation for affected features

### 3. How would you prevent this in the future?

**Proactive Measures:**
- Implement comprehensive database monitoring and alerting
- Set up automated scaling for database connections
- Establish query performance baselines and regression testing
- Implement proper connection pooling with circuit breakers
- Set up database replica lag monitoring
- Create runbooks for database performance incidents

**Long-term Solutions:**
- Database query optimization and indexing strategies
- Implement caching layers (Redis) for frequent operations
- Set up automated database performance testing in CI/CD
- Establish capacity planning and load testing procedures

### 4. What monitoring/alerting would you set up?

**Critical Metrics:**
- Database response time percentiles (p50, p95, p99)
- Connection pool utilization and queue length
- Query execution time and slow query detection
- Database CPU, memory, and disk I/O utilization
- Application error rates and timeout frequencies

**Alert Thresholds:**
- Database response time > 1 second for 5 consecutive minutes
- Connection pool utilization > 80%
- Error rate > 5% for any 2-minute window
- Slow query execution time > 5 seconds


