CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  mode TEXT NOT NULL,
  config_json TEXT,
  last_run_at INTEGER,
  last_status TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES sources(id),
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  summary TEXT,
  content TEXT,
  published_at INTEGER,
  hash TEXT NOT NULL,
  raw_json TEXT,
  notified INTEGER NOT NULL DEFAULT 0,
  state_json TEXT,
  prev_state_json TEXT,
  state_changed_at INTEGER,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_items_source_created ON items(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_state_changed ON items(source_id, state_changed_at DESC);

CREATE TABLE IF NOT EXISTS states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  source_id TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  changed INTEGER NOT NULL DEFAULT 0,
  diff_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_states_item_time ON states(item_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS run_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT,
  error TEXT,
  items_new INTEGER DEFAULT 0,
  items_total INTEGER DEFAULT 0,
  state_changes INTEGER DEFAULT 0
);
