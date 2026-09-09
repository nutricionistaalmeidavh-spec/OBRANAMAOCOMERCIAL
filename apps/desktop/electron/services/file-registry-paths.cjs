const path = require('node:path')

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function affectedRegisteredFiles(db, target) {
  const resolvedTarget = path.resolve(target)
  return db.db.prepare('SELECT id,caminho,nome_original,nome_armazenado,hash FROM arquivos').all()
    .filter((row) => row.caminho && isInside(resolvedTarget, row.caminho))
}

function applyPathMappings(db, mappings) {
  for (const mapping of mappings) {
    db.db.prepare('UPDATE arquivos SET caminho=?,nome_armazenado=? WHERE id=?')
      .run(mapping.nextPath, path.basename(mapping.nextPath), mapping.id)
  }
}

function syncRegisteredPaths(db, previous, next) {
  const previousResolved = path.resolve(previous)
  const nextResolved = path.resolve(next)
  const rows = affectedRegisteredFiles(db, previousResolved)
  const mappings = rows.map((row) => ({
    ...row,
    previousPath: row.caminho,
    nextPath: path.join(nextResolved, path.relative(previousResolved, row.caminho))
  }))
  if (!mappings.length) return []
  db.db.transaction(() => applyPathMappings(db, mappings))()
  return mappings
}

function removeRegisteredPaths(db, target) {
  const rows = affectedRegisteredFiles(db, target)
  if (!rows.length) return []
  db.db.transaction(() => {
    for (const row of rows) {
      db.db.prepare("UPDATE documentos SET arquivo_id=NULL,deleted_at=COALESCE(deleted_at,CURRENT_TIMESTAMP) WHERE arquivo_id=?").run(row.id)
      db.db.prepare('DELETE FROM arquivos WHERE id=?').run(row.id)
    }
  })()
  return rows
}

function pathMappingsForRoot(db, previousRoot, nextRoot) {
  const previous = path.resolve(previousRoot)
  const next = path.resolve(nextRoot)
  return affectedRegisteredFiles(db, previous).map((row) => ({
    ...row,
    previousPath: row.caminho,
    nextPath: path.join(next, path.relative(previous, row.caminho))
  }))
}

module.exports = { affectedRegisteredFiles, applyPathMappings, syncRegisteredPaths, removeRegisteredPaths, pathMappingsForRoot, isInside }
