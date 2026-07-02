ALTER TABLE sources ADD COLUMN schedule TEXT;

INSERT INTO sources (id, name, kind, mode, schedule, config_json, created_at)
VALUES
  (
    'kiro-changelog',
    'Kiro Changelog',
    'feed',
    'append',
    '0 * * * *',
    '{"feedUrl":"https://kiro.dev/changelog/feed.rss"}',
    1751328000000
  ),
  (
    'openai-blog',
    'OpenAI Blog',
    'feed',
    'append',
    '0 * * * *',
    '{"feedUrl":"https://openai.com/news/rss.xml"}',
    1751328000000
  ),
  (
    'openrouter-blog',
    'OpenRouter Blog',
    'feed',
    'append',
    '0 * * * *',
    '{"feedUrl":"https://openrouter.ai/blog/feed.xml"}',
    1751328000000
  )
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  kind = excluded.kind,
  mode = excluded.mode,
  schedule = excluded.schedule,
  config_json = excluded.config_json;
