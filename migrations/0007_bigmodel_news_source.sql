INSERT INTO sources (id, name, kind, mode, config_json, created_at)
VALUES
  (
    'bigmodel-news',
    'BigModel News',
    'webpage',
    'append',
    NULL,
    1751328000000
  )
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  kind = excluded.kind,
  mode = excluded.mode,
  config_json = excluded.config_json;
