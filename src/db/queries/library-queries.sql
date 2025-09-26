-- Library Management System - Complex Queries (Task 2.2)
-- Depends on schema in src/db/migrations/003-library-schema.sql

-- =============================================
-- 1) Overdue Books: currently overdue borrowings
--    - Show user name, book title, borrowed date, due date, days overdue
--    - Only items with returned_date IS NULL and due_date < today
-- =============================================
-- Notes:
--  - julianday('now') - julianday(due_date) computes days overdue as a real; CAST to INTEGER for whole days
--  - WHERE clause ensures only active overdue items are returned

-- name: overdue_books
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
ORDER BY days_overdue DESC, br.due_date ASC;


-- =============================================
-- 2) Popular Books: Top 5 most borrowed in last 6 months
--    - Include book details and borrow count
--    - Order by most borrowed first, then title
-- =============================================
-- Notes:
--  - Uses a date window on borrowed_date
--  - GROUP BY book to aggregate borrow counts

-- name: popular_books_last_6_months
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
-- 3) User Statistics: active users with totals
--    - For each active user, show:
--        * total books ever borrowed
--        * current outstanding (not yet returned)
--    - Include user details
-- =============================================
-- Notes:
--  - LEFT JOINs to include users with zero borrowings
--  - COALESCE to normalize NULL aggregates to 0

-- name: user_statistics
SELECT
    u.id,
    u.name,
    u.email,
    u.phone,
    u.membership_date,
    COALESCE(t.total_borrowed, 0) AS total_borrowed,
    COALESCE(o.current_outstanding, 0) AS current_outstanding
FROM library_users u
LEFT JOIN (
    SELECT br.user_id, COUNT(*) AS total_borrowed
    FROM borrowings br
    GROUP BY br.user_id
)
AS t ON t.user_id = u.id
LEFT JOIN (
    SELECT br.user_id, COUNT(*) AS current_outstanding
    FROM borrowings br
    WHERE br.returned_date IS NULL
    GROUP BY br.user_id
)
AS o ON o.user_id = u.id
WHERE u.is_active = 1
ORDER BY u.name ASC;


-- =============================================
-- 4) Revenue Report: monthly fines collected for current year
--    - Group by month, show month name and total fines collected
--    - Only include months with collected fines (> 0)
-- =============================================
-- Assumptions:
--  - Fines are considered collected at the time of return (returned_date)
--  - Only positive fine_amount values are included
--  - Current year filter uses strftime('%Y','now')

-- name: revenue_report_current_year
WITH fines AS (
  SELECT
    br.*
  FROM borrowings br
  WHERE br.returned_date IS NOT NULL
    AND br.fine_amount > 0
    AND strftime('%Y', br.returned_date) = strftime('%Y', 'now')
)
SELECT
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
FROM fines
GROUP BY strftime('%m', returned_date)
HAVING total_fines > 0
ORDER BY month_number ASC;

