ALTER TABLE billing_orders ADD COLUMN provider_checkout_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_orders_checkout ON billing_orders(provider,provider_checkout_id) WHERE provider_checkout_id IS NOT NULL;

INSERT OR REPLACE INTO app_schema_meta(key,value,updated_at) VALUES ('schema_version','6',CURRENT_TIMESTAMP);
