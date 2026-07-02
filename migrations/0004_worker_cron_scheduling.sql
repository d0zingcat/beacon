-- Scheduling is handled by Cloudflare Worker cron triggers (wrangler.jsonc).
ALTER TABLE sources DROP COLUMN schedule;

INSERT INTO sources (id, name, kind, mode, config_json, created_at)
VALUES
  (
    'kiro-changelog',
    'Kiro Changelog',
    'feed',
    'append',
    '{"feedUrl":"https://kiro.dev/changelog/feed.rss"}',
    1751328000000
  ),
  (
    'openai-blog',
    'OpenAI Blog',
    'feed',
    'append',
    '{"feedUrl":"https://openai.com/news/rss.xml"}',
    1751328000000
  ),
  (
    'openrouter-blog',
    'OpenRouter Blog',
    'feed',
    'append',
    '{"feedUrl":"https://openrouter.ai/blog/feed.xml"}',
    1751328000000
  ),
  (
    'cursor-changelog',
    'Cursor Changelog',
    'webpage',
    'append',
    NULL,
    1751328000000
  ),
  (
    'cursor-blog',
    'Cursor Blog',
    'webpage',
    'append',
    NULL,
    1751328000000
  ),
  (
    'anthropic-blog',
    'Anthropic Blog',
    'webpage',
    'append',
    NULL,
    1751328000000
  ),
  (
    'bedrock-models',
    'AWS Bedrock Models',
    'webpage',
    'append',
    NULL,
    1751328000000
  ),
  (
    'dmit-stock',
    'DMIT VPS Stock',
    'webpage',
    'state',
    NULL,
    1751328000000
  )
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  kind = excluded.kind,
  mode = excluded.mode,
  config_json = excluded.config_json;
