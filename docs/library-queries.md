## Library Management - Complex Queries (Task 2.2)

This document explains four SQL queries for the library schema defined in `src/db/migrations/003-library-schema.sql`.

Tables used: `library_users`, `books`, `borrowings`.

### 1) Overdue Books

Goal: List currently overdue borrowings with user and book details.

Key points:
- Filters `returned_date IS NULL` and `due_date < today` to include only active overdue items.
- `days_overdue` computed using `julianday('now') - julianday(due_date)` and cast to integer.

See query name `overdue_books` in `src/db/queries/library-queries.sql`.

### 2) Popular Books (Last 6 Months)

Goal: Top 5 most borrowed books in the last 6 months.

Key points:
- Uses a 6-month window on `borrowed_date`.
- Aggregates by book and orders by borrow count.
- Includes book details for direct reporting.

See query name `popular_books_last_6_months`.

### 3) User Statistics (Active Users)

Goal: For each active user, show total books borrowed and current outstanding.

Key points:
- `LEFT JOIN` subqueries to include users with zero history.
- `COALESCE` guards against NULL aggregates.
- Filters `u.is_active = 1`.

See query name `user_statistics`.

### 4) Revenue Report (Current Year)

Goal: Total fines collected per month for the current year.

Key points:
- CTE filters to returns with positive `fine_amount` within the current year.
- Groups by month number, derives a friendly `month_name`.
- `HAVING total_fines > 0` excludes empty months.

See query name `revenue_report_current_year`.

### Edge Cases and Handling

- Users without borrowings: included with `0` stats in user statistics.
- Books never borrowed: excluded from popular list by definition.
- Overdue computation: uses current date (`DATE('now')`) and integer days to avoid fractional reporting.
- Fines: zero/NULL fine rows are ignored for revenue.

### Performance Notes

- Indexes used:
  - `borrowings(user_id)`, `borrowings(book_id)`, `borrowings(borrowed_date)`, `borrowings(due_date)`
  - `library_users(is_active)`, `books(title)`, `books(author)` as needed
- Composite indexes:
  - `(user_id, returned_date)` to speed active-outstanding lookups
  - `(book_id, borrowed_date)` for popularity windows


