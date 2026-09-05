CREATE TABLE IF NOT EXISTS billing_plan_versions (
  id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
  interval_code TEXT NOT NULL DEFAULT 'monthly' CHECK(interval_code IN ('monthly','yearly','one_time')),
  modules_json TEXT NOT NULL,
  channels_json TEXT NOT NULL,
  max_users INTEGER NOT NULL DEFAULT 10,
  max_projects INTEGER NOT NULL DEFAULT 5,
  max_devices INTEGER NOT NULL DEFAULT 2,
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  UNIQUE(plan_code,version)
);
CREATE INDEX IF NOT EXISTS idx_billing_plan_active ON billing_plan_versions(plan_code,active,version DESC);

CREATE TABLE IF NOT EXISTS billing_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  company_id TEXT,
  requested_company_name TEXT NOT NULL,
  plan_version_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  financial_status TEXT NOT NULL DEFAULT 'created',
  idempotency_key TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'asaas',
  provider_customer_id TEXT,
  provider_payment_id TEXT,
  provider_subscription_id TEXT,
  provider_status TEXT,
  checkout_url TEXT,
  license_id TEXT,
  reconciliation_required INTEGER NOT NULL DEFAULT 0 CHECK(reconciliation_required IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id,idempotency_key),
  UNIQUE(provider,provider_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_billing_orders_user ON billing_orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_orders_company ON billing_orders(company_id,created_at DESC);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  plan_version_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'asaas',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  financial_status TEXT NOT NULL DEFAULT 'pending',
  current_period_end TEXT,
  license_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider,provider_subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_company ON billing_subscriptions(company_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS billing_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  subscription_id TEXT,
  provider TEXT NOT NULL DEFAULT 'asaas',
  provider_payment_id TEXT NOT NULL,
  provider_status TEXT,
  financial_status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider,provider_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_billing_payments_order ON billing_payments(order_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_payments_subscription ON billing_payments(subscription_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS billing_provider_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_payment_id TEXT,
  provider_subscription_id TEXT,
  external_reference TEXT,
  processing_status TEXT NOT NULL DEFAULT 'received',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  payload_json TEXT NOT NULL,
  occurred_at TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider,provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_billing_events_processing ON billing_provider_events(processing_status,created_at);

CREATE TABLE IF NOT EXISTS license_audit (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  action TEXT NOT NULL,
  source TEXT NOT NULL,
  actor_user_id TEXT,
  actor_email TEXT,
  order_id TEXT,
  previous_version INTEGER,
  next_version INTEGER,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_license_audit_license ON license_audit(license_id,created_at DESC);

INSERT OR REPLACE INTO app_schema_meta(key,value,updated_at) VALUES ('schema_version','4',CURRENT_TIMESTAMP);
