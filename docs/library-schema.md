## Library Management System Schema

This document explains the schema design for a Library Management System and the rationale behind constraints and indexes. The schema is provided as a standalone SQL file at `src/db/migrations/003-library-schema.sql` and is intentionally not wired into the existing app migration pipeline to avoid conflicts with the current Task app domain.

### Entities

- Books: id, title, author, isbn, publication_year, available_copies, total_copies
- Users: id, name, email, phone, membership_date, is_active
- Borrowings: id, user_id, book_id, borrowed_date, due_date, returned_date, fine_amount

### Tables and Constraints

1) `library_users`
- Primary key: `id` INTEGER AUTOINCREMENT
- Required fields: `name` (1..100 chars), `email` (unique, contains '@')
- `is_active` constrained to 0/1, defaults to 1
- `membership_date` defaults to current date
- Timestamps: `created_at`, `updated_at` with an update trigger

Rationale: Separate table name from existing `users` to prevent collision with Task app. Basic validation via CHECKs keeps invalid values out (e.g., name length, email structure, is_active domain).

2) `books`
- `title`, `author` required; length 1..255
- `isbn` unique; CHECK ensures 10 or 13 characters (common ISBN lengths)
- `publication_year` CHECK bounded between 1000 and (current year + 1)
- Quantities: `available_copies`, `total_copies` are non-negative with CHECK enforcing `available_copies <= total_copies`
- Timestamps + update trigger

Rationale: Enforces strong domain constraints for data quality and supports fast lookups by title/author/ISBN.

3) `borrowings`
- Foreign keys: `user_id` -> `library_users.id`, `book_id` -> `books.id`, with `ON UPDATE CASCADE` and `ON DELETE RESTRICT`
- Temporal constraints: `due_date >= borrowed_date`; `returned_date >= borrowed_date` when present
- `fine_amount` non-negative
- Timestamps + update trigger

Rationale: Referential integrity ensures only valid users/books can be referenced, and temporal consistency prevents illogical dates.

### Index Strategy

- `library_users`
  - `email` (unique + index): quick lookup by email
  - `is_active`: filter active members efficiently

- `books`
  - `isbn` (unique + index): exact book lookup
  - `title`, `author`: support common search filters
  - `publication_year`: range and sorting queries

- `borrowings`
  - `user_id`, `book_id`: frequent joins/filters
  - `borrowed_date`, `due_date`: reporting and overdue queries
  - Composite indexes:
    - `(user_id, returned_date)`: active borrowings per user when `returned_date IS NULL`
    - `(book_id, borrowed_date)`: popularity/time-based queries

Note: In SQLite, partial indexes could further optimize `returned_date IS NULL`, but for portability we use composite indexes and can add partial ones if needed.

### Availability Triggers (Optional Guards)

- On INSERT of a borrowing without `returned_date`, decrement `books.available_copies` when `available_copies > 0`; abort if it would go negative.
- On UPDATE setting `returned_date` (from NULL to a date), increment `available_copies` but cap at `total_copies`.

Rationale: These are safeguards to maintain consistency at the database layer. In high-throughput systems, this logic is often handled in application-level transactions to avoid contention; triggers provide an extra safety net here.

### Data Types and Portability

- Uses SQLite-compatible types. For Postgres/MySQL, equivalent constraints apply (e.g., `BOOLEAN`, `NUMERIC`, `GENERATED ALWAYS AS IDENTITY`).
- Date/time fields are `DATE`/`DATETIME` for clarity; app code should store ISO 8601 strings or appropriate native types.

### How to Apply

This file is standalone. To experiment locally in SQLite:

```sql
-- from a SQLite shell connected to your test DB
.read src/db/migrations/003-library-schema.sql
```

Or copy the statements into your migration tool of choice if integrating into another project.


