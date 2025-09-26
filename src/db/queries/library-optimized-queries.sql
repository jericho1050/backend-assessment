-- Library Management System - Optimized Queries (Task 6.2)
-- Performance-optimized versions of the complex queries

-- =============================================
-- 1) Optimized Overdue Books Query
-- =============================================
-- Uses covering index and optimized sort order
-- name: overdue_books_optimized
SELECT
    u.name AS user_name,
    b.title AS book_title,
    br.borrowed_date,
    br.due_date,
    CAST((julianday('now') - julianday(br.due_date)) AS INTEGER) AS days_overdue
FROM borrowings br
JOIN library_users u ON u.id = br.user_id
JOIN books b ON b.id = br.book_id
WHERE br.returned_date IS NULL
  AND br.due_date < DATE('now')
ORDER BY br.due_date ASC, br.user_id ASC;

-- =============================================
-- 2) Optimized Popular Books Query
-- =============================================
-- Uses materialized view for better performance
-- name: popular_books_optimized
SELECT * FROM popular_books_6m
ORDER BY borrow_count DESC, title ASC
LIMIT 5;

-- Alternative: Direct query with optimized indexes
-- name: popular_books_direct_optimized
SELECT
    b.id,
    b.title,
    b.author,
    b.isbn,
    b.publication_year,
    COUNT(*) AS borrow_count
FROM borrowings br
JOIN books b ON b.id = br.book_id
WHERE br.borrowed_date >= DATE('now', '-6 months')
GROUP BY b.id, b.title, b.author, b.isbn, b.publication_year
ORDER BY borrow_count DESC, b.title ASC
LIMIT 5;

-- =============================================
-- 3) Optimized User Statistics Query
-- =============================================
-- Single aggregation instead of multiple subqueries
-- name: user_statistics_optimized
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

-- =============================================
-- 4) Optimized Revenue Report Query
-- =============================================
-- Uses materialized view for better performance
-- name: revenue_report_optimized
SELECT * FROM monthly_revenue_view
WHERE year = strftime('%Y', 'now')
ORDER BY month_key ASC;

-- Alternative: Direct query with optimized indexes
-- name: revenue_report_direct_optimized
SELECT
    strftime('%Y-%m', returned_date) AS month_key,
    CASE strftime('%m', returned_date)
        WHEN '01' THEN 'January'
        WHEN '02' THEN 'February'
        WHEN '03' THEN 'March'
        WHEN '04' THEN 'April'
        WHEN '05' THEN 'May'
        WHEN '06' THEN 'June'
        WHEN '07' THEN 'July'
        WHEN '08' THEN 'August'
        WHEN '09' THEN 'September'
        WHEN '10' THEN 'October'
        WHEN '11' THEN 'November'
        WHEN '12' THEN 'December'
    END AS month_name,
    strftime('%m', returned_date) AS month_number,
    ROUND(SUM(fine_amount), 2) AS total_fines
FROM borrowings
WHERE returned_date IS NOT NULL
  AND fine_amount > 0
  AND strftime('%Y', returned_date) = strftime('%Y', 'now')
GROUP BY strftime('%Y-%m', returned_date)
ORDER BY month_key ASC;

-- =============================================
-- 5) N+1 Query Solutions
-- =============================================

-- Eager loading: Users with their active borrowings
-- name: users_with_borrowings_eager
SELECT
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    br.id as borrowing_id,
    br.borrowed_date,
    br.due_date,
    br.returned_date,
    b.title as book_title,
    b.author as book_author
FROM library_users u
LEFT JOIN borrowings br ON br.user_id = u.id AND br.returned_date IS NULL
LEFT JOIN books b ON b.id = br.book_id
WHERE u.is_active = 1
ORDER BY u.name, br.borrowed_date DESC;

-- Batch loading: Get borrowings for multiple users
-- name: borrowings_by_user_ids
SELECT
    br.user_id,
    br.id as borrowing_id,
    br.borrowed_date,
    br.due_date,
    br.returned_date,
    b.title as book_title,
    b.author as book_author
FROM borrowings br
JOIN books b ON b.id = br.book_id
WHERE br.user_id IN (?) -- Parameter: array of user IDs
ORDER BY br.user_id, br.borrowed_date DESC;

-- =============================================
-- 6) Full-Text Search Queries
-- =============================================

-- Search books by title and author
-- name: search_books_fts
SELECT
    b.id,
    b.title,
    b.author,
    b.isbn,
    b.publication_year,
    b.available_copies,
    b.total_copies,
    rank
FROM books_fts
JOIN books b ON b.id = books_fts.rowid
WHERE books_fts MATCH ?
ORDER BY rank;

-- Search with filters
-- name: search_books_fts_with_filters
SELECT
    b.id,
    b.title,
    b.author,
    b.isbn,
    b.publication_year,
    b.available_copies,
    b.total_copies,
    rank
FROM books_fts
JOIN books b ON b.id = books_fts.rowid
WHERE books_fts MATCH ?
  AND b.available_copies > 0
  AND b.publication_year >= ?
ORDER BY rank;

-- =============================================
-- 7) Pagination Optimized Queries
-- =============================================

-- Cursor-based pagination for borrowings
-- name: borrowings_paginated_cursor
SELECT
    br.id,
    br.user_id,
    br.book_id,
    br.borrowed_date,
    br.due_date,
    br.returned_date,
    u.name as user_name,
    b.title as book_title
FROM borrowings br
JOIN library_users u ON u.id = br.user_id
JOIN books b ON b.id = br.book_id
WHERE br.id > ? -- Cursor: last seen ID
ORDER BY br.id ASC
LIMIT ?;

-- Offset-based pagination with optimization
-- name: borrowings_paginated_offset
SELECT
    br.id,
    br.user_id,
    br.book_id,
    br.borrowed_date,
    br.due_date,
    br.returned_date,
    u.name as user_name,
    b.title as book_title
FROM borrowings br
JOIN library_users u ON u.id = br.user_id
JOIN books b ON b.id = br.book_id
ORDER BY br.borrowed_date DESC, br.id DESC
LIMIT ? OFFSET ?;

-- =============================================
-- 8) Performance Monitoring Queries
-- =============================================

-- Query execution plan analysis
-- name: explain_query_plan
EXPLAIN QUERY PLAN 
SELECT * FROM borrowings 
WHERE user_id = ? AND returned_date IS NULL;

-- Index usage statistics
-- name: index_usage_stats
SELECT * FROM index_usage_stats;

-- Table statistics
-- name: table_statistics
SELECT * FROM table_stats;

-- Slow query identification (requires logging)
-- name: recent_queries
SELECT 
    'Query performance monitoring requires query logging setup' as note;