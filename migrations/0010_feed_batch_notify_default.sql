-- Default merged-notification list size for RSS feed sources.
UPDATE sources
SET config_json = '{"feedUrl":"https://kiro.dev/changelog/feed.rss","batchNotifyMaxItems":10}'
WHERE id = 'kiro-changelog';

UPDATE sources
SET config_json = '{"feedUrl":"https://openai.com/news/rss.xml","batchNotifyMaxItems":10}'
WHERE id = 'openai-blog';

UPDATE sources
SET config_json = '{"feedUrl":"https://openrouter.ai/blog/feed.xml","batchNotifyMaxItems":10}'
WHERE id = 'openrouter-blog';

UPDATE sources
SET config_json = '{"feedUrl":"https://lilianweng.github.io/index.xml","batchNotifyMaxItems":10}'
WHERE id = 'lilianweng-blog';
