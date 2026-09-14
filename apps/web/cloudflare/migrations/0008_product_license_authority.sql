CREATE TABLE IF NOT EXISTS product_licenses (
  id TEXT PRIMARY KEY,
  product_code TEXT NOT NULL,
  email TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','trialing','past_due','cancelled','revoked')),
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  source TEXT NOT NULL,
  external_ref TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_licenses_identity_uq
  ON product_licenses(product_code,email,source,external_ref);
CREATE INDEX IF NOT EXISTS product_licenses_lookup_idx
  ON product_licenses(product_code,email,status,expires_at);

CREATE TABLE IF NOT EXISTS product_license_events (
  id TEXT PRIMARY KEY,
  license_id TEXT,
  product_code TEXT NOT NULL,
  email TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  source TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (license_id) REFERENCES product_licenses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS product_license_events_email_idx
  ON product_license_events(product_code,email,created_at DESC);
