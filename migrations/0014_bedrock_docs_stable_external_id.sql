-- Bedrock UG RSS reuses <guid> across distinct entries; switch to stable externalIds
-- and clear previously collapsed rows so the next crawl can re-seed quietly.
UPDATE sources
SET config_json = '{"feedUrl":"https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-ug.rss","batchNotifyMaxItems":10,"externalIdMode":"stable"}'
WHERE id = 'bedrock-docs';

DELETE FROM notification_deliveries WHERE source_id = 'bedrock-docs';
DELETE FROM states WHERE item_id IN (SELECT id FROM items WHERE source_id = 'bedrock-docs');
DELETE FROM items WHERE source_id = 'bedrock-docs';
