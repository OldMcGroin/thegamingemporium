-- Run this in the D1 database bound as SUGGESTIONS_DB (or RATINGS_DB).
CREATE TABLE IF NOT EXISTS project_ratings (
 project TEXT NOT NULL,
 voter_hash TEXT NOT NULL,
 stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(project,voter_hash)
);
CREATE INDEX IF NOT EXISTS idx_project_ratings_project ON project_ratings(project);
CREATE TABLE IF NOT EXISTS project_rating_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 ip_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_project_rating_events_ip_time ON project_rating_events(ip_hash,created_at);
