-- Run on the same D1 database used by the ratings API.
CREATE TABLE IF NOT EXISTS project_playability (
 project TEXT NOT NULL,
 voter_hash TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('completed','issues','partial','broken','untested')),
 platform TEXT NOT NULL,
 details TEXT NOT NULL DEFAULT '',
 build_version TEXT NOT NULL DEFAULT '',
 visible INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(project,voter_hash)
);
CREATE INDEX IF NOT EXISTS idx_playability_project ON project_playability(project,visible,updated_at);
CREATE TABLE IF NOT EXISTS project_playability_events (id INTEGER PRIMARY KEY AUTOINCREMENT,ip_hash TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_playability_events ON project_playability_events(ip_hash,created_at);
