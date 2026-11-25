// Only use identities from the authorized session, local import ledger or a fresh claim.
function localRdoBinding(db, session, config, baseUrl) {
  const { company, project, device } = session
  if (!session.authorized || !company?.id || !project?.id || !device?.id ||
      String(project.companyId) !== String(company.id) || config.tenant?.baseUrl !== baseUrl ||
      config.tenant?.companyId !== String(company.id) || session.role !== 'admin') return null
  const receipts = db.prepare(`SELECT DISTINCT o.empresa_id AS companyId,o.id AS workId
    FROM field_rdo_links l JOIN rdos r ON r.id=l.rdo_id JOIN obras o ON o.id=r.obra_id
    JOIN empresas e ON e.id=o.empresa_id WHERE l.remote_project_id=?
    AND o.deleted_at IS NULL AND e.deleted_at IS NULL AND r.deleted_at IS NULL LIMIT 2`).all(String(project.id))
  if (receipts.length) return receipts.length === 1 ? receipts[0] : null
  const origin = project.workSource
  if (origin && String(origin.sourceDeviceId) === String(device.id) && Number.isSafeInteger(origin.localWorkId)) {
    return db.prepare('SELECT empresa_id AS companyId,id AS workId FROM obras WHERE id=? AND deleted_at IS NULL').get(origin.localWorkId) || null
  }
  const fresh=config.firstProject
  if (!fresh || fresh.baseUrl!==baseUrl || fresh.companyId!==String(company.id) ||
      fresh.projectId!==String(project.id) || fresh.deviceId!==String(device.id) || !company.name || !project.name) return null
  // No matching by names: a restored / demo / previously used database must not be published.
  if (db.prepare('SELECT 1 FROM empresas LIMIT 1').get() || db.prepare('SELECT 1 FROM obras LIMIT 1').get()) return null
  const companyId=Number(db.prepare('INSERT INTO empresas(razao_social) VALUES (?)').run(company.name).lastInsertRowid)
  const workId=Number(db.prepare('INSERT INTO obras(empresa_id,nome) VALUES (?,?)').run(companyId,project.name).lastInsertRowid)
  return {companyId,workId}
}
module.exports={localRdoBinding}
