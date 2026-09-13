-- Reserved lifetime commercial entitlement.
-- Customer identity is encoded in source so the public repository does not
-- publish the readable address. The D1 record itself contains the normalized
-- e-mail because licenseByEmail validates ownership before onboarding.

INSERT OR REPLACE INTO kv_records(collection,id,record_json,created_at,updated_at)
VALUES(
  'licenses',
  '11e1a89038929aa010bb22c601502da1',
  json_object(
    'email',CAST(X'65766572746f6e2e656e6740686f746d61696c2e636f6d' AS TEXT),
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

-- Email-scoped index used by bootstrap. This is the normalized/safe table key.
INSERT OR REPLACE INTO kv_records(collection,id,record_json,created_at,updated_at)
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
