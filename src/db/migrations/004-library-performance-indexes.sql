-- Library Management System - Performance Optimization Indexes (Task 6.2)
-- Additional indexes to optimize query performance beyond the base schema

-- =============================================
-- Partial Indexes for Active Borrowings
-- =============================================

-- Index for active loans (returned_date IS NULL)
CREATE INDEX IF NOT EXISTS idx_borrowings_active_loans 
ON borrowings(user_id, due_date) 
WHERE returned_date IS NULL;

-- Index for overdue books optimization
CREATE INDEX IF NOT EXISTS idx_borrowings_overdue 
ON borrowings(due_date, returned_date, user_id);

-- =============================================
-- Revenue and Reporting Indexes
-- =============================================

-- Index for revenue reporting (only returned books with fines)
CREATE INDEX IF NOT EXISTS idx_borrowings_revenue 
ON borrowings(returned_date, fine_amount) 
WHERE returned_date IS NOT NULL AND fine_amount > 0;

-- Index for monthly revenue aggregation
CREATE INDEX IF NOT EXISTS idx_borrowings_monthly_revenue 
ON borrowings(
    strftime('%Y-%m', returned_date), 
    fine_amount
) WHERE returned_date IS NOT NULL AND fine_amount > 0;

-- =============================================
-- User Statistics Optimization
-- =============================================

-- Covering index for user statistics (includes all needed columns)
CREATE INDEX IF NOT EXISTS idx_borrowings_user_stats 
ON borrowings(user_id, returned_date, book_id);

-- =============================================
-- Book Search Optimization
-- =============================================

-- Full-text search index for books (SQLite FTS5)
-- Note: This creates a virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
    title, 
    author, 
    content='books',
    content_rowid='id'
);

-- Populate the FTS table with existing data
INSERT INTO books_fts(books_fts) VALUES('rebuild');

-- =============================================
-- Popular Books Optimization
-- =============================================

-- Materialized view for popular books (6 months)
CREATE VIEW IF NOT EXISTS popular_books_6m AS
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

-- =============================================
-- Monthly Revenue View
-- =============================================

-- Materialized view for monthly revenue
CREATE VIEW IF NOT EXISTS monthly_revenue_view AS
SELECT
    strftime('%Y-%m', returned_date) AS month_key,
    strftime('%Y', returned_date) AS year,
    strftime('%m', returned_date) AS month,
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
    ROUND(SUM(fine_amount), 2) AS total_fines,
    COUNT(*) AS fine_count
FROM borrowings
WHERE returned_date IS NOT NULL
  AND fine_amount > 0
GROUP BY strftime('%Y-%m', returned_date);

-- =============================================
-- Archive Tables for Historical Data
-- =============================================

-- Archive table for old completed borrowings (2+ years)
CREATE TABLE IF NOT EXISTS borrowings_archive (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    borrowed_date DATE NOT NULL,
    due_date DATE NOT NULL,
    returned_date DATE NOT NULL,
    fine_amount NUMERIC NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for archive table
CREATE INDEX IF NOT EXISTS idx_borrowings_archive_returned_date 
ON borrowings_archive(returned_date);

-- =============================================
-- Performance Monitoring Views
-- =============================================

-- View for index usage monitoring
CREATE VIEW IF NOT EXISTS index_usage_stats AS
SELECT 
    name,
    sql,
    CASE 
        WHEN name LIKE 'idx_%' THEN 'Custom Index'
        WHEN name LIKE 'sqlite_%' THEN 'SQLite System'
        ELSE 'Other'
    END AS index_type
FROM sqlite_master 
WHERE type = 'index' 
  AND name NOT LIKE 'sqlite_%'
ORDER BY name;

-- View for table statistics
CREATE VIEW IF NOT EXISTS table_stats AS
SELECT 
    'library_users' as table_name,
    COUNT(*) as row_count,
    COUNT(*) * 100 as estimated_size_bytes
FROM library_users
UNION ALL
SELECT 
    'books' as table_name,
    COUNT(*) as row_count,
    COUNT(*) * 200 as estimated_size_bytes
FROM books
UNION ALL
SELECT 
    'borrowings' as table_name,
    COUNT(*) as row_count,
    COUNT(*) * 150 as estimated_size_bytes
FROM borrowings;