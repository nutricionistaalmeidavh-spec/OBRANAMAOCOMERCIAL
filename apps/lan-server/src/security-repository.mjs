import { randomUUID } from 'node:crypto'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS lan_server_identity (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  server_id TEXT NOT NULL UNIQUE,
  setup_code_hash TEXT,
  company_id TEXT,
  company_name TEXT,
  cloud_base_url TEXT,
  server_token TEXT,
  claimed_at TEXT,
  last_cloud_refresh_at TEXT,
  identity_revision TEXT
);
CREATE TABLE IF NOT EXISTS lan_members_cache (
  member_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL,
  modules_json TEXT NOT NULL,
  channels_json TEXT NOT NULL,
  cloud_status TEXT NOT NULL,
  refreshed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lan_devices (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('active','revoked')),
  paired_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_lan_devices_member ON lan_devices(member_id);
CREATE INDEX IF NOT EXISTS idx_lan_devices_installation ON lan_devices(installation_id);
CREATE TABLE IF NOT EXISTS lan_pairing_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  member_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_by_device_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lan_pairing_codes_hash ON lan_pairing_codes(code_hash);
CREATE TABLE IF NOT EXISTS lan_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_member_id TEXT,
  actor_device_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
`

const parseJson = (value, fallback = []) => {
  try { return JSON.parse(String(value ?? '')) } catch { return fallback }
}

function mapMember(row) {
  if (!row) return null
  return {
    memberId: row.member_id,
    email: row.email,
    name: row.display_name || undefined,
    role: row.role,
    modules: parseJson(row.modules_json, []),
    channels: parseJson(row.channels_json, []),
    status: row.cloud_status,
    refreshedAt: row.refreshed_at
  }
}

function mapDevice(row) {
  if (!row) return null
  return {
    id: row.id,
    memberId: row.member_id,
    installationId: row.installation_id,
    deviceName: row.device_name,
    tokenHash: row.token_hash,
    status: row.status,
    pairedAt: row.paired_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at
  }
}

export class LanSecurityRepository {
  constructor({ db, now = () => new Date().toISOString() }) {
    if (!db) throw new Error('Banco central LAN não informado para segurança.')
    this.db = db
    this.now = now
    this.db.exec(SCHEMA)
  }

  withTransaction(work) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = work()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      throw error
    }
  }

  serverState() {
    const row = this.db.prepare('SELECT * FROM lan_server_identity WHERE id=1').get()
    if (!row) return null
    return {
      serverId: row.server_id,
      setupCodeHash: row.setup_code_hash,
      claimed: !!row.company_id,
      companyId: row.company_id,
      companyName: row.company_name,
      cloudBaseUrl: row.cloud_base_url,
      serverToken: row.server_token,
      claimedAt: row.claimed_at,
      lastCloudRefreshAt: row.last_cloud_refresh_at,
      identityRevision: row.identity_revision
    }
  }

  initializeServer({ serverId, setupCodeHash }) {
    if (!serverId || !setupCodeHash) throw new Error('Identidade inicial do servidor incompleta.')
    const current = this.serverState()
    if (!current) {
      this.db.prepare('INSERT INTO lan_server_identity(id,server_id,setup_code_hash) VALUES(1,?,?)').run(String(serverId), String(setupCodeHash))
    } else if (!current.claimed) {
      this.db.prepare('UPDATE lan_server_identity SET setup_code_hash=? WHERE id=1').run(String(setupCodeHash))
    }
    return this.serverState()
  }

  clearSetupCode() {
    this.db.prepare('UPDATE lan_server_identity SET setup_code_hash=NULL WHERE id=1').run()
    return this.serverState()
  }

  writeSnapshot(snapshot) {
    const state = this.serverState()
    if (state?.companyId && String(snapshot?.companyId || '') !== String(state.companyId)) throw new Error('Snapshot pertence a outra empresa.')
    const refreshedAt = String(snapshot?.generatedAt || this.now())
    this.db.prepare('DELETE FROM lan_members_cache').run()
    const insert = this.db.prepare('INSERT INTO lan_members_cache(member_id,email,display_name,role,modules_json,channels_json,cloud_status,refreshed_at) VALUES(?,?,?,?,?,?,?,?)')
    for (const member of snapshot?.members || []) {
      insert.run(String(member.memberId), String(member.email || ''), member.name ? String(member.name) : null, String(member.role || 'employee'), JSON.stringify(member.modules || []), JSON.stringify(member.channels || []), String(member.status || 'revoked'), refreshedAt)
    }
    this.db.prepare('UPDATE lan_server_identity SET identity_revision=?,last_cloud_refresh_at=? WHERE id=1').run(String(snapshot?.revision || ''), refreshedAt)
  }

  replaceSnapshot(snapshot) {
    return this.withTransaction(() => {
      this.writeSnapshot(snapshot)
      return this.serverState()
    })
  }

  claimServer({ company, cloudBaseUrl, serverToken, snapshot }) {
    const state = this.serverState()
    if (!state) throw new Error('Servidor LAN ainda não possui identidade local.')
    if (state.claimed) throw new Error('Servidor LAN já foi vinculado a uma empresa.')
    if (!company?.id || !serverToken || !cloudBaseUrl) throw new Error('Dados de vínculo do servidor incompletos.')
    if (String(snapshot?.companyId || '') !== String(company.id)) throw new Error('Snapshot não corresponde à empresa do vínculo.')
    const claimedAt = this.now()
    return this.withTransaction(() => {
      this.db.prepare('UPDATE lan_server_identity SET company_id=?,company_name=?,cloud_base_url=?,server_token=?,claimed_at=?,setup_code_hash=NULL WHERE id=1').run(String(company.id), String(company.name || ''), String(cloudBaseUrl), String(serverToken), claimedAt)
      this.writeSnapshot(snapshot)
      return this.serverState()
    })
  }

  member(memberId) {
    return mapMember(this.db.prepare('SELECT * FROM lan_members_cache WHERE member_id=?').get(String(memberId)))
  }

  members() {
    return this.db.prepare('SELECT * FROM lan_members_cache ORDER BY email COLLATE NOCASE').all().map(mapMember)
  }

  createDevice({ memberId, installationId, deviceName, tokenHash }) {
    if (!memberId || !installationId || !deviceName || !tokenHash) throw new Error('Dados do dispositivo LAN incompletos.')
    const id = randomUUID(), pairedAt = this.now()
    this.db.prepare("INSERT INTO lan_devices(id,member_id,installation_id,device_name,token_hash,status,paired_at,last_seen_at,revoked_at) VALUES(?,?,?,?,?,'active',?,?,NULL)").run(id, String(memberId), String(installationId), String(deviceName), String(tokenHash), pairedAt, pairedAt)
    return mapDevice(this.db.prepare('SELECT * FROM lan_devices WHERE id=?').get(id))
  }

  deviceByTokenHash(tokenHash) {
    return mapDevice(this.db.prepare('SELECT * FROM lan_devices WHERE token_hash=?').get(String(tokenHash)))
  }

  device(deviceId) {
    return mapDevice(this.db.prepare('SELECT * FROM lan_devices WHERE id=?').get(String(deviceId)))
  }

  touchDevice(deviceId) {
    this.db.prepare('UPDATE lan_devices SET last_seen_at=? WHERE id=?').run(this.now(), String(deviceId))
    return this.device(deviceId)
  }

  setDeviceStatus(deviceId, status) {
    if (!['active', 'revoked'].includes(status)) throw new Error('Status do dispositivo LAN inválido.')
    const revokedAt = status === 'revoked' ? this.now() : null
    const result = this.db.prepare('UPDATE lan_devices SET status=?,revoked_at=? WHERE id=?').run(status, revokedAt, String(deviceId))
    return Number(result.changes) ? this.device(deviceId) : null
  }

  listDevices() {
    return this.db.prepare('SELECT * FROM lan_devices ORDER BY paired_at DESC').all().map(mapDevice)
  }

  createPairingCode({ memberId, codeHash, expiresAt, createdByDeviceId }) {
    const id = randomUUID(), createdAt = this.now()
    this.db.prepare('INSERT INTO lan_pairing_codes(id,code_hash,member_id,expires_at,consumed_at,created_by_device_id,created_at) VALUES(?,?,?,?,NULL,?,?)').run(id, String(codeHash), String(memberId), String(expiresAt), String(createdByDeviceId), createdAt)
    return { id, memberId: String(memberId), expiresAt: String(expiresAt), createdByDeviceId: String(createdByDeviceId), createdAt }
  }

  consumePairingCode(codeHash) {
    const now = this.now()
    const row = this.db.prepare('SELECT * FROM lan_pairing_codes WHERE code_hash=? AND consumed_at IS NULL AND expires_at>? LIMIT 1').get(String(codeHash), now)
    if (!row) return null
    const result = this.db.prepare('UPDATE lan_pairing_codes SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND expires_at>?').run(now, row.id, now)
    if (!Number(result.changes)) return null
    return { id: row.id, memberId: row.member_id, expiresAt: row.expires_at, createdByDeviceId: row.created_by_device_id, consumedAt: now }
  }

  appendAudit({ actorMemberId = null, actorDeviceId = null, action, targetType = null, targetId = null, details = {} }) {
    if (!action) throw new Error('Ação de auditoria LAN não informada.')
    const result = this.db.prepare('INSERT INTO lan_audit(actor_member_id,actor_device_id,action,target_type,target_id,details_json,created_at) VALUES(?,?,?,?,?,?,?)').run(actorMemberId, actorDeviceId, String(action), targetType, targetId, JSON.stringify(details || {}), this.now())
    return Number(result.lastInsertRowid)
  }
}
