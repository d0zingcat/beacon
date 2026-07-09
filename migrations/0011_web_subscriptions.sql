CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS auth_magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_magic_links_email_created
  ON auth_magic_links(email, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS feishu_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  display_name TEXT NOT NULL,
  webhook_ciphertext TEXT NOT NULL,
  webhook_fingerprint TEXT NOT NULL,
  webhook_mask TEXT NOT NULL,
  status TEXT NOT NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_test_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feishu_channels_user_id ON feishu_channels(user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  channel_id INTEGER NOT NULL REFERENCES feishu_channels(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(channel_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_source_enabled
  ON subscriptions(source_id, enabled);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES feishu_channels(id),
  source_id TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  item_id INTEGER,
  event_key TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  sent_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(channel_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel_created
  ON notification_deliveries(channel_id, created_at DESC);
