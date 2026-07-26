CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_title TEXT NOT NULL,
  game_link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suggestions_status_date ON suggestions(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_ip_date ON suggestions(ip_hash, submitted_at DESC);
