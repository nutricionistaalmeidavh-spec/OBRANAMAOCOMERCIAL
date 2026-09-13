-- Reserved lifetime commercial entitlement.
-- The customer identity is intentionally not stored as plain text in the public
-- repository. Runtime onboarding creates the tenant/company and binds the admin
-- account on first authenticated access.

INSERT OR IGNORE INTO kv_records(collection,id,record_json,created_at,updated_at)
VALUES(
  'licenses',
  '11e1a89038929aa010bb22c601502da1',
  json_object(
    'code','RESERVED',
    'modules',json_array('finance','rh','contracts','rdo','obra360','dre','procurement','measurements','documents','universidade','ai'),
    'channels',json_array('desktop','mobile'),
    'status','active',
    'note','Acesso comercial vitalício reservado; tenant criado no primeiro acesso autenticado.',
    'plan','lifetime-manual',
    'maxUsers',10,
    'maxProjects',5,
    'maxDevices',2,
    'version',1,
    'createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now')
  ),
  strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);

-- Email-scoped index used by bootstrap. The readable address is not committed.
INSERT OR IGNORE INTO kv_records(collection,id,record_json,created_at,updated_at)
VALUES(
  'license_email_' || CAST(X'65766572746f6e5f656e675f686f746d61696c5f636f6d' AS TEXT) || '_e0fe7b2b',
  '06223016d70e5571ce5b85d2b7b28f57',
  json_object('licenseId','11e1a89038929aa010bb22c601502da1'),
  strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);

INSERT OR IGNORE INTO license_audit(id,license_id,action,source,previous_version,next_version,details_json,created_at)
VALUES(
  '7fa546e795407a07f27e433d95280037',
  '11e1a89038929aa010bb22c601502da1',
  'reserved_lifetime_created',
  'system',
  NULL,
  1,
  json_object('plan','lifetime-manual','tenantBinding','first-authenticated-access'),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);
