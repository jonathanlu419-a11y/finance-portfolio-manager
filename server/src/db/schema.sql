-- finance-portfolio-manager schema
-- Single-currency (CAD), integer-cents money, per-session (anonymous tenant) isolation.
-- Every domain row carries session_id and every query filters by it. No user accounts.

CREATE TABLE IF NOT EXISTS sessions (
  session_id   TEXT PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id                     SERIAL PRIMARY KEY,
  session_id             TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  code                   TEXT,
  name                   TEXT NOT NULL,
  nature                 TEXT NOT NULL CHECK (nature IN ('Asset', 'Liability', 'Revenue', 'Expense')),
  starting_balance_cents BIGINT NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounts_session ON accounts(session_id);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  name       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_session ON categories(session_id);

CREATE TABLE IF NOT EXISTS income_sources (
  id         SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  name       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_income_sources_session ON income_sources(session_id);

-- Visitor-defined Quick Add shortcuts.
CREATE TABLE IF NOT EXISTS shortcuts (
  id                     SERIAL PRIMARY KEY,
  session_id             TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  label                  TEXT NOT NULL,
  icon                   TEXT,
  kind                   TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'transfer', 'card_payment')),
  default_account_id     INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  default_counter_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  default_category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  default_income_source_id INTEGER REFERENCES income_sources(id) ON DELETE SET NULL,
  sort_order             INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_shortcuts_session ON shortcuts(session_id);

-- Journal entry header.
CREATE TABLE IF NOT EXISTS journal_entries (
  id               SERIAL PRIMARY KEY,
  session_id       TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  entry_date       DATE NOT NULL,
  description      TEXT,
  payee            TEXT,
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  income_source_id INTEGER REFERENCES income_sources(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entries_session ON journal_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_entries_session_date ON journal_entries(session_id, entry_date DESC);

-- Journal entry legs. amount_cents is always positive; `side` carries the sign semantics.
CREATE TABLE IF NOT EXISTS journal_lines (
  id           SERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  entry_id     INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  side         TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0)
);
CREATE INDEX IF NOT EXISTS idx_lines_session ON journal_lines(session_id);
CREATE INDEX IF NOT EXISTS idx_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_lines_account ON journal_lines(account_id);
