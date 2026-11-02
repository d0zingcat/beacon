-- OpenAI News RSS reuses <guid> across distinct entries (e.g. retell-ai in 2025 and 2026);
-- switch to stable externalIds and clear previously collapsed rows so the next crawl can re-seed quietly.
UPDATE sources
SET config_json = '{"feedUrl":"https://openai.com/news/rss.xml","batchNotifyMaxItems":10,"externalIdMode":"stable"}'
WHERE id = 'openai-blog';

DELETE FROM notification_deliveries WHERE source_id = 'openai-blog';
DELETE FROM states WHERE item_id IN (SELECT id FROM items WHERE source_id = 'openai-blog');
DELETE FROM items WHERE source_id = 'openai-blog';
