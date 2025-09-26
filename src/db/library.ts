import { Database } from 'bun:sqlite'
import { logger } from '@/utils/logger'

type RetryOptions = {
  maxAttempts: number
  initialDelayMs: number
  backoffFactor: number
}

const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 50,
  backoffFactor: 2
}

export class LibraryDatabase {
  private db: Database

  constructor(dbPath?: string) {
    const path = dbPath || process.env.LIB_DB_PATH || 'mycure.db'
    try {
      this.db = new Database(path)
      // Enforce foreign keys
      this.db.query('PRAGMA foreign_keys = ON').run()
    } catch (err) {
      logger.error('Failed to initialize Library DB', { error: String(err) })
      throw err
    }
  }

  get connection(): Database {
    return this.db
  }

  close(): void {
    try {
      this.db.close()
    } catch (err) {
      logger.warn('Error closing Library DB', { error: String(err) })
    }
  }

  private async retry<T>(fn: () => T, retry: RetryOptions = DEFAULT_RETRY): Promise<T> {
    let attempt = 0
    let delay = retry.initialDelayMs
    while (true) {
      try {
        return fn()
      } catch (err: any) {
        attempt += 1
        const isBusy = typeof err?.message === 'string' && /database is locked|busy/i.test(err.message)
        if (attempt >= retry.maxAttempts || !isBusy) {
          logger.error('DB operation failed', { attempt, error: String(err) })
          throw err
        }
        await new Promise((r) => setTimeout(r, delay))
        delay *= retry.backoffFactor
      }
    }
  }

  // Prepared statements for core operations
  private stmts = {
    getBookForUpdate: (db: Database) => db.query(`
      SELECT id, available_copies, total_copies
      FROM books
      WHERE id = ?
    `),
    decrementBook: (db: Database) => db.query(`
      UPDATE books
      SET available_copies = available_copies - 1
      WHERE id = ? AND available_copies > 0
    `),
    incrementBook: (db: Database) => db.query(`
      UPDATE books
      SET available_copies = MIN(total_copies, available_copies + 1)
      WHERE id = ?
    `),
    insertBorrowing: (db: Database) => db.query(`
      INSERT INTO borrowings (user_id, book_id, borrowed_date, due_date, fine_amount)
      VALUES (?, ?, DATE('now'), ?, 0)
      RETURNING id
    `),
    setReturned: (db: Database) => db.query(`
      UPDATE borrowings
      SET returned_date = DATE('now'), fine_amount = ?
      WHERE id = ? AND returned_date IS NULL
    `)
  }

  // Borrow a book transactionally
  async borrowBook(userId: number, bookId: number, dueDateISO: string): Promise<{ borrowingId: number }> {
    if (!Number.isInteger(userId) || userId <= 0) throw new Error('Invalid userId')
    if (!Number.isInteger(bookId) || bookId <= 0) throw new Error('Invalid bookId')
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(dueDateISO)) throw new Error('Invalid dueDate format (expected YYYY-MM-DD)')

    return this.retry(() => {
      this.db.run('BEGIN IMMEDIATE')
      try {
        const getBook = this.stmts.getBookForUpdate(this.db)
        const book = getBook.get(bookId) as { id: number; available_copies: number; total_copies: number } | null
        if (!book) throw new Error('Book not found')
        if (book.available_copies <= 0) throw new Error('No available copies')

        const dec = this.stmts.decrementBook(this.db)
        const res = dec.run(bookId)
        if ((res as any).changes !== 1) throw new Error('Failed to reserve copy')

        const ins = this.stmts.insertBorrowing(this.db)
        const row = ins.get(userId, bookId, dueDateISO) as { id: number }

        this.db.run('COMMIT')
        return { borrowingId: row.id }
      } catch (err) {
        try { this.db.run('ROLLBACK') } catch {}
        throw err
      }
    })
  }

  // Return a book with optional fine, transactionally
  async returnBook(borrowingId: number, fineAmountCents: number = 0): Promise<void> {
    if (!Number.isInteger(borrowingId) || borrowingId <= 0) throw new Error('Invalid borrowingId')
    if (!Number.isInteger(fineAmountCents) || fineAmountCents < 0) throw new Error('Invalid fine amount')

    return this.retry(() => {
      this.db.run('BEGIN IMMEDIATE')
      try {
        // Get borrowing for book id
        const getBr = this.db.query(`SELECT id, book_id FROM borrowings WHERE id = ? AND returned_date IS NULL`)
        const br = getBr.get(borrowingId) as { id: number; book_id: number } | null
        if (!br) throw new Error('Active borrowing not found')

        const setRet = this.stmts.setReturned(this.db)
        const res = setRet.run(fineAmountCents / 100, borrowingId)
        if ((res as any).changes !== 1) throw new Error('Failed to set return')

        const inc = this.stmts.incrementBook(this.db)
        inc.run(br.book_id)

        this.db.run('COMMIT')
      } catch (err) {
        try { this.db.run('ROLLBACK') } catch {}
        throw err
      }
    })
  }
}

export const libraryDb = new LibraryDatabase()


