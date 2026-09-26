-- Hosted checkout columns and indexes are part of the canonical billing schema in 0004.
-- Existing databases may already have them because ensureBillingSchema() repairs schema drift at runtime.
-- Keep this historical migration side-effect free so Wrangler can record it without duplicate-column failures.

INSERT OR REPLACE INTO app_schema_meta(key,value,updated_at) VALUES ('schema_version','6',CURRENT_TIMESTAMP);
