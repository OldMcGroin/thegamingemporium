-- The Gaming Emporium - D1 popularity optimisation
-- Safe to run more than once.

-- Small shared cache for expensive global leaderboard queries.
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Makes all-time and Hidden Gems ranking reads cheap.
CREATE INDEX IF NOT EXISTS idx_clicks_count ON clicks(count);

-- Helps category Trending requests that filter by project id + day.
CREATE INDEX IF NOT EXISTS idx_events_daily_id_day ON events_daily(id, day);
