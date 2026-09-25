CREATE TABLE IF NOT EXISTS manual_license_sales (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  operation TEXT NOT NULL CHECK (operation IN ('grant','renew','legacy_classification')),
  acquisition_channel TEXT NOT NULL CHECK (acquisition_channel IN ('mercado_livre','direct_sale','shopee','gumroad','courtesy','partnership','other')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid','pending','unpaid','not_applicable','unknown')),
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  paid_at TEXT,
  external_order_ref TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS manual_license_sales_email_created_idx
  ON manual_license_sales(product_code,email,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS manual_license_sales_payment_created_idx
  ON manual_license_sales(product_code,payment_status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS manual_license_sales_channel_created_idx
  ON manual_license_sales(product_code,acquisition_channel,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS manual_license_sales_license_created_idx
  ON manual_license_sales(license_id,created_at DESC,id DESC);
