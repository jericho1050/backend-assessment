## Library DB Integration (Task 2.3)

This module provides connection management, prepared statements with parameter binding, retry logic for transient failures, and transactional borrowing/return flows compatible with Bun + SQLite.

File: `src/db/library.ts`

### Connection Management

- Uses `bun:sqlite`.
- Path from `process.env.LIB_DB_PATH` or defaults to `mycure.db`.
- Enables `PRAGMA foreign_keys = ON`.
- Exposes `libraryDb.connection` and `.close()`.

### Retry Logic

- Exponential backoff for transient `database is locked/busy` errors.
- Defaults: 3 attempts, 50ms initial delay, x2 backoff.

### Prepared Statements

- Core prepared queries: get book, decrement/increment copies, insert borrowing, set returned.
- All inputs validated before execution to mitigate SQL injection.

### Transactions

`borrowBook(userId, bookId, dueDateISO)`
- BEGIN IMMEDIATE transaction.
- Check book availability, decrement `available_copies` atomically, insert borrowing row.
- COMMIT; on error, ROLLBACK.

`returnBook(borrowingId, fineAmountCents)`
- BEGIN IMMEDIATE.
- Mark `returned_date` and set `fine_amount` (decimal expressed by cents / 100).
- Increment book `available_copies` with cap at `total_copies`.
- COMMIT; on error, ROLLBACK.

### Pooling Considerations

SQLite is embedded and does not employ a client/server pool. Concurrency is handled via WAL mode and short transactions. The retry mechanism handles lock contention. For Postgres/MySQL, configure a pool (e.g., `pg`/`mysql2`) and port the same patterns.

### Usage Example

```ts
import { libraryDb } from '@/db/library'

await libraryDb.borrowBook(1, 42, '2025-12-31')
await libraryDb.returnBook(10, 350) // 3.50 fine
```


