# Library Management System - Database Performance Optimization (Task 6.2)

## Performance Analysis

### 1. Potential Performance Bottlenecks

#### **Large Table Scans**
- **borrowings table**: Full table scans on date range queries without proper indexes
- **books table**: Text search on title/author without full-text search capabilities
- **library_users table**: Active user filtering without optimized indexes

#### **Complex Joins**
- **Three-table joins**: borrowings ↔ library_users ↔ books for reporting queries
- **Subquery aggregations**: User statistics with multiple LEFT JOINs
- **Date range filtering**: Overdue books and popular books queries

#### **Concurrent Access Issues**
- **available_copies updates**: Race conditions during high-concurrency borrowing
- **Trigger-based updates**: Potential lock contention on book availability
- **Transaction isolation**: Long-running transactions blocking other operations

#### **Aggregation Performance**
- **COUNT() operations**: User statistics and popular books queries
- **GROUP BY with ORDER BY**: Revenue reports and popularity rankings
- **Date-based aggregations**: Monthly revenue calculations

### 2. Database Index Strategy

#### **Existing Indexes (from schema)**
```sql
-- Primary indexes (automatic)
PRIMARY KEY on all id fields

-- Foreign key indexes
idx_borrowings_user_id ON borrowings(user_id)
idx_borrowings_book_id ON borrowings(book_id)

-- Single column indexes
idx_library_users_email ON library_users(email)
idx_library_users_is_active ON library_users(is_active)
idx_books_isbn ON books(isbn)
idx_books_title ON books(title)
idx_books_author ON books(author)
idx_books_publication_year ON books(publication_year)
idx_borrowings_borrowed_date ON borrowings(borrowed_date)
idx_borrowings_due_date ON borrowings(due_date)
idx_borrowings_returned_date_null ON borrowings(returned_date)

-- Composite indexes
idx_borrowings_user_active ON borrowings(user_id, returned_date)
idx_borrowings_book_borrowed ON borrowings(book_id, borrowed_date)
```

#### **Additional Recommended Indexes**
```sql
-- Partial index for active borrowings (SQLite)
CREATE INDEX idx_borrowings_active_loans 
ON borrowings(user_id, due_date) 
WHERE returned_date IS NULL;

-- Composite index for overdue queries
CREATE INDEX idx_borrowings_overdue 
ON borrowings(due_date, returned_date, user_id);

-- Index for revenue reporting
CREATE INDEX idx_borrowings_revenue 
ON borrowings(returned_date, fine_amount) 
WHERE returned_date IS NOT NULL AND fine_amount > 0;

-- Full-text search index (if supported)
CREATE VIRTUAL TABLE books_fts USING fts5(title, author, content='books');

-- Covering index for user statistics
CREATE INDEX idx_borrowings_user_stats 
ON borrowings(user_id, returned_date, book_id);
```

### 3. Query Optimizations

#### **Overdue Books Query Optimization**
```sql
-- Original query uses basic indexes
-- Optimized version with covering index
SELECT
    u.name AS user_name,
    b.title AS book_title,
    br.borrowed_date,
    br.due_date,
    CAST((julianday('now') - julianday(br.due_date)) AS INTEGER) AS days_overdue
FROM borrowings br
USE INDEX (idx_borrowings_overdue)  -- Hint for optimal index
JOIN library_users u ON u.id = br.user_id
JOIN books b ON b.id = br.book_id
WHERE br.returned_date IS NULL
  AND br.due_date < DATE('now')
ORDER BY br.due_date ASC, br.user_id ASC;  -- Optimized sort order
```

#### **Popular Books Query Optimization**
```sql
-- Use materialized view for frequently accessed data
CREATE VIEW popular_books_6m AS
SELECT
    b.id,
    b.title,
    b.author,
    b.isbn,
    b.publication_year,
    COUNT(*) AS borrow_count,
    MAX(br.borrowed_date) AS last_borrowed
FROM borrowings br
JOIN books b ON b.id = br.book_id
WHERE br.borrowed_date >= DATE('now', '-6 months')
GROUP BY b.id, b.title, b.author, b.isbn, b.publication_year;

-- Query with pagination optimization
SELECT * FROM popular_books_6m
ORDER BY borrow_count DESC, title ASC
LIMIT 5 OFFSET 0;
```

#### **User Statistics Query Optimization**
```sql
-- Optimized with single aggregation
SELECT
    u.id,
    u.name,
    u.email,
    u.phone,
    u.membership_date,
    COUNT(br.id) AS total_borrowed,
    COUNT(CASE WHEN br.returned_date IS NULL THEN 1 END) AS current_outstanding
FROM library_users u
LEFT JOIN borrowings br ON br.user_id = u.id
WHERE u.is_active = 1
GROUP BY u.id, u.name, u.email, u.phone, u.membership_date
ORDER BY u.name ASC;
```

#### **Revenue Report Query Optimization**
```sql
-- Pre-aggregated monthly data
CREATE INDEX idx_borrowings_monthly_revenue 
ON borrowings(
    strftime('%Y-%m', returned_date), 
    fine_amount
) WHERE returned_date IS NOT NULL AND fine_amount > 0;

-- Optimized query
SELECT
    strftime('%Y-%m', returned_date) AS month_key,
    CASE strftime('%m', returned_date)
        WHEN '01' THEN 'January'
        WHEN '02' THEN 'February'
        -- ... other months
    END AS month_name,
    ROUND(SUM(fine_amount), 2) AS total_fines
FROM borrowings
WHERE returned_date IS NOT NULL
  AND fine_amount > 0
  AND strftime('%Y', returned_date) = strftime('%Y', 'now')
GROUP BY strftime('%Y-%m', returned_date)
ORDER BY month_key ASC;
```

### 4. N+1 Query Problem Solutions

#### **Problem Example**
```typescript
// BAD: N+1 queries
const users = await getActiveUsers();
for (const user of users) {
    user.borrowings = await getBorrowingsByUserId(user.id);  // N queries
}
```

#### **Solution 1: Eager Loading with JOINs**
```sql
-- Single query with JOIN
SELECT
    u.id, u.name, u.email,
    br.id as borrowing_id, br.borrowed_date, br.due_date, br.returned_date,
    b.title, b.author
FROM library_users u
LEFT JOIN borrowings br ON br.user_id = u.id AND br.returned_date IS NULL
LEFT JOIN books b ON b.id = br.book_id
WHERE u.is_active = 1
ORDER BY u.name, br.borrowed_date;
```

#### **Solution 2: Batch Loading Pattern**
```typescript
// GOOD: Batch loading
const users = await getActiveUsers();
const userIds = users.map(u => u.id);
const borrowings = await getBorrowingsByUserIds(userIds);  // Single query

// Group borrowings by user_id
const borrowingsByUser = groupBy(borrowings, 'user_id');
users.forEach(user => {
    user.borrowings = borrowingsByUser[user.id] || [];
});
```

#### **Solution 3: DataLoader Pattern**
```typescript
class BorrowingDataLoader {
    private cache = new Map();
    private batchLoadFn: (userIds: number[]) => Promise<Borrowing[]>;

    async load(userId: number): Promise<Borrowing[]> {
        if (this.cache.has(userId)) {
            return this.cache.get(userId);
        }

        // Batch multiple requests
        const result = await this.batchLoadFn([userId]);
        this.cache.set(userId, result);
        return result;
    }

    async loadMany(userIds: number[]): Promise<Borrowing[]> {
        const uncachedIds = userIds.filter(id => !this.cache.has(id));
        if (uncachedIds.length > 0) {
            const results = await this.batchLoadFn(uncachedIds);
            results.forEach(borrowing => {
                const userBorrowings = this.cache.get(borrowing.user_id) || [];
                userBorrowings.push(borrowing);
                this.cache.set(borrowing.user_id, userBorrowings);
            });
        }

        return userIds.flatMap(id => this.cache.get(id) || []);
    }
}
```

### 5. Advanced Optimizations

#### **Query Result Caching**
```typescript
// Cache frequently accessed queries
const cache = new Map();

async function getPopularBooks(): Promise<Book[]> {
    const cacheKey = 'popular_books_6m';
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const books = await db.query(`
        SELECT * FROM popular_books_6m 
        ORDER BY borrow_count DESC 
        LIMIT 5
    `);

    cache.set(cacheKey, books);
    setTimeout(() => cache.delete(cacheKey), 300000); // 5 min TTL
    return books;
}
```

#### **Read Replicas for Reporting**
```typescript
// Separate read/write connections
const writeDb = new Database('library.db');
const readDb = new Database('library_replica.db');

// Use read replica for reporting queries
async function getRevenueReport(): Promise<RevenueData[]> {
    return readDb.query(`
        SELECT * FROM monthly_revenue_view 
        WHERE year = strftime('%Y', 'now')
    `);
}
```

#### **Partitioning Strategies**
```sql
-- Partition borrowings by year
CREATE TABLE borrowings_2024 AS 
SELECT * FROM borrowings 
WHERE strftime('%Y', borrowed_date) = '2024';

CREATE TABLE borrowings_2025 AS 
SELECT * FROM borrowings 
WHERE strftime('%Y', borrowed_date) = '2025';

-- Union view for queries
CREATE VIEW borrowings_all AS
SELECT * FROM borrowings_2024
UNION ALL
SELECT * FROM borrowings_2025;
```

#### **Archive Strategies**
```sql
-- Archive old completed borrowings
CREATE TABLE borrowings_archive AS 
SELECT * FROM borrowings 
WHERE returned_date IS NOT NULL 
  AND returned_date < DATE('now', '-2 years');

-- Delete archived records
DELETE FROM borrowings 
WHERE returned_date IS NOT NULL 
  AND returned_date < DATE('now', '-2 years');
```

### 6. Performance Monitoring

#### **Query Execution Analysis**
```sql
-- Enable query logging
PRAGMA compile_options;

-- Analyze query plans
EXPLAIN QUERY PLAN 
SELECT * FROM borrowings 
WHERE user_id = 1 AND returned_date IS NULL;

-- Monitor index usage
SELECT name, sql FROM sqlite_master 
WHERE type = 'index' AND name LIKE 'idx_%';
```

#### **Performance Metrics**
- **Query execution time**: Monitor slow queries (>100ms)
- **Index hit ratio**: Track index usage vs table scans
- **Lock contention**: Monitor transaction wait times
- **Cache hit ratio**: Track application-level caching effectiveness
- **Connection pool utilization**: Monitor database connections

### 7. Implementation Recommendations

1. **Immediate**: Add missing composite indexes for common query patterns
2. **Short-term**: Implement query result caching for popular books and user statistics
3. **Medium-term**: Add materialized views for complex aggregations
4. **Long-term**: Consider read replicas and partitioning for large datasets
5. **Monitoring**: Set up query performance monitoring and alerting