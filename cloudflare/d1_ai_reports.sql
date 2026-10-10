CREATE TABLE IF NOT EXISTS ai_reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 game_title TEXT NOT NULL, game_link TEXT NOT NULL, classification TEXT NOT NULL,
 evidence_url TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
 ip_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
 submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_reports_status ON ai_reports(status,submitted_at);
CREATE INDEX IF NOT EXISTS idx_ai_reports_rate ON ai_reports(ip_hash,submitted_at);
