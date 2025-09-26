-- Library Management System Schema (Standalone)
-- Note: This schema is provided as a standalone SQL file and is not wired
-- into the app's migration sequence to avoid impacting the existing task app.

-- Enable foreign key constraints (SQLite)
PRAGMA foreign_keys = ON;

-- ====================
-- Table: users (library)
-- ====================
CREATE TABLE IF NOT EXISTS library_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    email TEXT NOT NULL UNIQUE CHECK (instr(email, '@') > 1),
    phone TEXT,
    membership_date DATE NOT NULL DEFAULT (DATE('now')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_library_users_email ON library_users(email);
CREATE INDEX IF NOT EXISTS idx_library_users_is_active ON library_users(is_active);

-- Trigger to update updated_at on change
CREATE TRIGGER IF NOT EXISTS trg_library_users_updated_at
AFTER UPDATE ON library_users
FOR EACH ROW
BEGIN
  UPDATE library_users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ====================
-- Table: books
-- ====================
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 255),
    author TEXT NOT NULL CHECK (length(author) BETWEEN 1 AND 255),
    isbn TEXT NOT NULL UNIQUE CHECK (length(isbn) IN (10,13)),
    publication_year INTEGER CHECK (publication_year BETWEEN 1000 AND strftime('%Y','now') + 1),
    available_copies INTEGER NOT NULL CHECK (available_copies >= 0),
    total_copies INTEGER NOT NULL CHECK (total_copies >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (available_copies <= total_copies)
);

CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_publication_year ON books(publication_year);

CREATE TRIGGER IF NOT EXISTS trg_books_updated_at
AFTER UPDATE ON books
FOR EACH ROW
BEGIN
  UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ====================
-- Table: borrowings
-- ====================
CREATE TABLE IF NOT EXISTS borrowings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    borrowed_date DATE NOT NULL DEFAULT (DATE('now')),
    due_date DATE NOT NULL,
    returned_date DATE,
    fine_amount NUMERIC NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES library_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (book_id) REFERENCES books(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CHECK (returned_date IS NULL OR returned_date >= borrowed_date),
    CHECK (due_date >= borrowed_date)
);

-- Useful indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_borrowings_user_id ON borrowings(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_book_id ON borrowings(book_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_borrowed_date ON borrowings(borrowed_date);
CREATE INDEX IF NOT EXISTS idx_borrowings_due_date ON borrowings(due_date);
CREATE INDEX IF NOT EXISTS idx_borrowings_returned_date_null ON borrowings(returned_date);

-- Composite indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_borrowings_user_active ON borrowings(user_id, returned_date);
CREATE INDEX IF NOT EXISTS idx_borrowings_book_borrowed ON borrowings(book_id, borrowed_date);

CREATE TRIGGER IF NOT EXISTS trg_borrowings_updated_at
AFTER UPDATE ON borrowings
FOR EACH ROW
BEGIN
  UPDATE borrowings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ====================
-- Derived integrity helpers (optional)
-- Note: Availability updates are typically handled in application/transactions.
-- These triggers demonstrate safeguard logic but may be avoided in write-heavy systems.

-- Decrement available_copies on new borrowing when available
CREATE TRIGGER IF NOT EXISTS trg_borrowings_decrement_available
AFTER INSERT ON borrowings
FOR EACH ROW
WHEN NEW.returned_date IS NULL
BEGIN
  UPDATE books
  SET available_copies = available_copies - 1
  WHERE id = NEW.book_id AND available_copies > 0;
END;

-- Increment available_copies on return
CREATE TRIGGER IF NOT EXISTS trg_borrowings_increment_available
AFTER UPDATE OF returned_date ON borrowings
FOR EACH ROW
WHEN NEW.returned_date IS NOT NULL AND (OLD.returned_date IS NULL)
BEGIN
  UPDATE books
  SET available_copies = MIN(total_copies, available_copies + 1)
  WHERE id = NEW.book_id;
END;

