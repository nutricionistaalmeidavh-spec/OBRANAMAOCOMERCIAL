// Printable map of the work's locations (A4 landscape): pavimentos in columns, complements
// in their chain, open items per location. Built from data only; no user HTML is trusted.
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const isFloor = (row) => row.nivel !== null && row.nivel !== undefined
const byOrder = (a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR')

function locationTree(rows) {
  const ids = new Set(rows.map((r) => Number(r.id)))
  const children = new Map()
  for (const row of rows) if (row.local_pai_id && ids.has(Number(row.local_pai_id))) children.set(Number(row.local_pai_id), [...(children.get(Number(row.local_pai_id)) || []), row])
  const chain = (row, depth, out = [], guard = 0) => {
    if (guard > 30) return out
    for (const child of (children.get(Number(row.id)) || []).sort(byOrder)) { out.push({ row: child, depth }); chain(child, depth + 1, out, guard + 1) }
    return out
  }
  const roots = rows.filter((r) => !r.local_pai_id || !ids.has(Number(r.local_pai_id)))
  const columns = roots.filter(isFloor).sort((a, b) => Number(a.nivel) - Number(b.nivel)).map((root) => ({ root, items: chain(root, 0) }))
  const direct = roots.filter((r) => !isFloor(r)).sort(byOrder).flatMap((root) => [{ row: root, depth: 0 }, ...chain(root, 1)])
  if (direct.length) columns.push({ root: null, items: direct })
  return columns
}

function locationsPdfHtml({ work, rows, counts, progress = null, generatedAt = new Date() }) {
  const total = (id) => counts?.byLocal?.[String(id)]?.total || 0
  const badge = (id) => total(id) ? `<span class="b">${total(id)}</span>` : ''
  const heat = (level) => {
    const pct = progress?.[String(level)]
    return pct === undefined || pct === null ? '' : `<small class="pct">${Math.round(pct)}% concluído</small>`
  }
  const columns = locationTree(rows)
  const cols = columns.map(({ root, items }) => `<section class="col">
    ${root ? `<div class="floor"><strong>${esc(root.nome)}</strong>${badge(root.id)}<small>Pavimento ${esc(root.nivel)}</small>${heat(root.nivel)}</div>` : '<div class="floor direct"><strong>Direto na obra</strong></div>'}
    <ul>${items.map(({ row, depth }) => `<li style="margin-left:${depth * 10}px">${depth ? '↳ ' : ''}${esc(row.nome)}${badge(row.id)}</li>`).join('')}</ul>
  </section>`).join('')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Locais da obra — ${esc(work?.nome)}</title><style>
  @page{size:A4 landscape;margin:12mm}body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2a3d;margin:0}
  h1{font-size:18px;margin:0}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #2f67d8;padding-bottom:6px;margin-bottom:10px}
  header small{color:#5b6678;font-size:10px}.grid{display:grid;grid-template-columns:repeat(${Math.min(Math.max(columns.length, 1), 6)},1fr);gap:8px}
  .col{break-inside:avoid;border:1px solid #dbe1e9;border-radius:6px;padding:6px}.floor{background:#eeedfe;border:1px solid #7f77dd;border-radius:5px;padding:4px 6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center}
  .floor.direct{background:#f6f7f9;border:1px dashed #9aa4b2}.floor small{width:100%;font-size:9px;color:#5b5a8a}.floor .pct{color:#0f6e56}
  ul{list-style:none;margin:5px 0 0;padding:0}li{font-size:10px;padding:2px 0;border-bottom:1px dotted #e3e8ef}.b{display:inline-block;margin-left:4px;font-size:9px;font-weight:700;color:#a3261c;background:#fdecea;border-radius:9px;padding:0 5px}
  footer{margin-top:10px;font-size:9px;color:#5b6678}</style></head><body>
  <header><div><h1>Locais da obra — ${esc(work?.nome)}</h1><small>${rows.length} locais · ${counts?.open ?? 0} pendências abertas na obra</small></div><small>Gerado em ${esc(generatedAt.toLocaleString('pt-BR'))}</small></header>
  <div class="grid">${cols || '<p>Nenhum local cadastrado.</p>'}</div>
  <footer>Números em vermelho: pendências e ocorrências do RDO em aberto, somando o que fica dentro de cada local.</footer>
  </body></html>`
}

/** Share of each pavimento's subetapas done (completed = 1, in progress = ½), 0–100. */
function floorProgress(list = []) {
  const acc = {}
  for (const item of Array.isArray(list) ? list : []) {
    const key = String(item.nivel), weight = item.status === 'completed' ? 1 : item.status === 'in_progress' ? 0.5 : 0
    acc[key] = acc[key] || { sum: 0, n: 0 }; acc[key].sum += weight; acc[key].n++
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v.n ? (v.sum / v.n) * 100 : 0]))
}

module.exports = { locationsPdfHtml, locationTree, floorProgress }
