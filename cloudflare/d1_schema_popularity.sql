-- The Gaming Emporium - Popularity (D1)

-- All-time click totals
CREATE TABLE IF NOT EXISTS clicks (
  id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Rolling window events (daily)
-- day: YYYY-MM-DD (SQLite date('now'))
CREATE TABLE IF NOT EXISTS events_daily (
  day TEXT NOT NULL,
  id TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, id)
);

-- Optional: helpful indexes
CREATE INDEX IF NOT EXISTS idx_events_daily_day ON events_daily(day);
CREATE INDEX IF NOT EXISTS idx_events_daily_id ON events_daily(id);
