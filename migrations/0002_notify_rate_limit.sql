CREATE TABLE IF NOT EXISTS notify_rate_limit (
  channel TEXT PRIMARY KEY,
  next_available_at INTEGER NOT NULL DEFAULT 0
);
