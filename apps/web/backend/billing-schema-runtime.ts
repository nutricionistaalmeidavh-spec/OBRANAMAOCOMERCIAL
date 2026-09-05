import type { RuntimeEnv } from '../cloudflare/sdk';

const BILLING_SCHEMA_VERSION=6;
const CANONICAL_PLAN_CODES=[
  'essencial_monthly','essencial_yearly',
  'pro_monthly','pro_yearly',
  'empresa_monthly','empresa_yearly'
] as const;

let billingSchemaReady=false;
const stamp=()=>new Date().toISOString();

async function ensureColumn(env:Pick<RuntimeEnv,'DB'>,table:string,column:string,definition:string){
  const rows=await env.DB.prepare(`PRAGMA table_info(${table})`).all<{name:string}>();
  if((rows.results||[]).some(row=>row.name===column))return;
  try{
    await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run();
  }catch(cause){
    const message=cause instanceof Error?cause.message:String(cause||'');
    if(!/duplicate column name/i.test(message))throw cause;
  }
}

async function writeSchemaVersion(env:Pick<RuntimeEnv,'DB'>,table:string){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ${table} (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare(
    `INSERT INTO ${table}(key,value,updated_at) VALUES('schema_version',?,?)
     ON CONFLICT(key) DO UPDATE SET
       value=CASE WHEN CAST(value AS INTEGER)<? THEN excluded.value ELSE value END,
       updated_at=CASE WHEN CAST(value AS INTEGER)<? THEN excluded.updated_at ELSE updated_at END`
  ).bind(String(BILLING_SCHEMA_VERSION),stamp(),BILLING_SCHEMA_VERSION,BILLING_SCHEMA_VERSION).run();
}

export async function ensureBillingSchema(env:Pick<RuntimeEnv,'DB'>){
  if(billingSchemaReady)return;

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS billing_plan_versions (
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
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS billing_orders (
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
    provider_checkout_id TEXT,
    provider_status TEXT,
    checkout_url TEXT,
    license_id TEXT,
    reconciliation_required INTEGER NOT NULL DEFAULT 0 CHECK(reconciliation_required IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id,idempotency_key),
    UNIQUE(provider,provider_payment_id)
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS billing_subscriptions (
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
    initial_order_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(provider,provider_subscription_id)
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS billing_payments (
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
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS billing_provider_events (
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
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS license_audit (
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
  )`).run();

  await ensureColumn(env,'billing_orders','provider_checkout_id','provider_checkout_id TEXT');
  await ensureColumn(env,'billing_subscriptions','initial_order_id','initial_order_id TEXT');

  const indexes=[
    'CREATE INDEX IF NOT EXISTS idx_billing_plan_active ON billing_plan_versions(plan_code,active,version DESC)',
    'CREATE INDEX IF NOT EXISTS idx_billing_orders_user ON billing_orders(user_id,created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_billing_orders_company ON billing_orders(company_id,created_at DESC)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_orders_checkout ON billing_orders(provider,provider_checkout_id) WHERE provider_checkout_id IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_company ON billing_subscriptions(company_id,updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_initial_order ON billing_subscriptions(initial_order_id)',
    'CREATE INDEX IF NOT EXISTS idx_billing_payments_order ON billing_payments(order_id,updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_billing_payments_subscription ON billing_payments(subscription_id,updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_billing_events_processing ON billing_provider_events(processing_status,created_at)',
    'CREATE INDEX IF NOT EXISTS idx_license_audit_license ON license_audit(license_id,created_at DESC)'
  ];
  for(const sql of indexes)await env.DB.prepare(sql).run();

  await env.DB.prepare(`INSERT OR IGNORE INTO billing_plan_versions(
    id,plan_code,version,name,price_cents,currency,interval_code,
    modules_json,channels_json,max_users,max_projects,max_devices,active,created_at
  ) VALUES
  ('catalog_essencial_monthly_v1','essencial_monthly',1,'Essencial',14900,'BRL','monthly','["obra360","rdo","documents","universidade"]','["desktop","mobile"]',5,3,2,1,CURRENT_TIMESTAMP),
  ('catalog_essencial_yearly_v1','essencial_yearly',1,'Essencial',149000,'BRL','yearly','["obra360","rdo","documents","universidade"]','["desktop","mobile"]',5,3,2,1,CURRENT_TIMESTAMP),
  ('catalog_pro_monthly_v1','pro_monthly',1,'Pro',29900,'BRL','monthly','["finance","rh","contracts","rdo","obra360","dre","procurement","measurements","documents","universidade","ai"]','["desktop","mobile"]',20,10,5,1,CURRENT_TIMESTAMP),
  ('catalog_pro_yearly_v1','pro_yearly',1,'Pro',299000,'BRL','yearly','["finance","rh","contracts","rdo","obra360","dre","procurement","measurements","documents","universidade","ai"]','["desktop","mobile"]',20,10,5,1,CURRENT_TIMESTAMP),
  ('catalog_empresa_monthly_v1','empresa_monthly',1,'Empresa',49900,'BRL','monthly','["finance","rh","contracts","rdo","obra360","dre","procurement","measurements","documents","universidade","ai"]','["desktop","mobile"]',60,30,15,1,CURRENT_TIMESTAMP),
  ('catalog_empresa_yearly_v1','empresa_yearly',1,'Empresa',499000,'BRL','yearly','["finance","rh","contracts","rdo","obra360","dre","procurement","measurements","documents","universidade","ai"]','["desktop","mobile"]',60,30,15,1,CURRENT_TIMESTAMP)`).run();

  for(const code of CANONICAL_PLAN_CODES){
    const active=await env.DB.prepare('SELECT id FROM billing_plan_versions WHERE plan_code=? AND active=1 ORDER BY version DESC LIMIT 1').bind(code).first<{id:string}>();
    if(!active)await env.DB.prepare('UPDATE billing_plan_versions SET active=1 WHERE id=(SELECT id FROM billing_plan_versions WHERE plan_code=? ORDER BY version DESC LIMIT 1)').bind(code).run();
  }

  await writeSchemaVersion(env,'schema_metadata');
  await writeSchemaVersion(env,'app_schema_meta');
  billingSchemaReady=true;
}
