INSERT INTO sources (id, name, kind, mode, config_json, created_at)
VALUES
  (
    'bedrock-docs',
    'AWS Bedrock User Guide',
    'feed',
    'append',
    '{"feedUrl":"https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-ug.rss","batchNotifyMaxItems":10}',
    1784764800000
  )
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  kind = excluded.kind,
  mode = excluded.mode,
  config_json = excluded.config_json;
