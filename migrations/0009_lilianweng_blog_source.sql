INSERT INTO sources (id, name, kind, mode, config_json, created_at)
VALUES
  (
    'lilianweng-blog',
    'Lil''Log',
    'feed',
    'append',
    '{"feedUrl":"https://lilianweng.github.io/index.xml"}',
    1751500800000
  )
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  kind = excluded.kind,
  mode = excluded.mode,
  config_json = excluded.config_json;
