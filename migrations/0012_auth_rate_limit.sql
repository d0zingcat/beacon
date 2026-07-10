CREATE TABLE IF NOT EXISTS auth_rate_limit (
  key TEXT PRIMARY KEY,
  next_available_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
