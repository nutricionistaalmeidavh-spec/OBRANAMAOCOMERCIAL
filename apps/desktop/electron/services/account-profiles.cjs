const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const normalize = value => String(value || '').trim().toLowerCase()
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
function createAccountProfiles(app, args = process.argv, override = process.env.OBRA_NA_MAO_DATA_DIR) {
  const root = path.join(app.getPath('appData'), 'obra-na-mao-comercial')
  const registryPath = path.join(root, 'accounts.json')
  const selected = args.find(arg => arg.startsWith('--obra-account='))?.slice('--obra-account='.length) || 'principal'
  if (!/^(principal|[a-f0-9]{64})$/.test(selected)) throw new Error('Perfil de conta inválido.')
  const read = () => {
    try { const data = JSON.parse(fs.readFileSync(registryPath, 'utf8')); return Array.isArray(data.accounts) ? data.accounts : [] }
    catch { return [] }
  }
  const save = accounts => {
    fs.mkdirSync(root, { recursive: true })
    const temp = registryPath + '.tmp'
    fs.writeFileSync(temp, JSON.stringify({ version: 1, accounts }, null, 2), { mode: 0o600 })
    fs.renameSync(temp, registryPath)
  }
  const idFor = email => crypto.createHash('sha256').update(normalize(email)).digest('hex')
  const list = () => [{ id: 'principal', email: read().find(x => x.id === 'principal')?.email || null }, ...read().filter(x => x.id !== 'principal')]
  const current = () => list().find(x => x.id === selected) || (selected === 'principal' ? { id: 'principal', email: null } : null)
  if (!current()) throw new Error('Conta não cadastrada neste computador.')
  const add = email => {
    const value = normalize(email)
    if (!validEmail(value)) throw new Error('Informe um e-mail válido.')
    const accounts = read()
    const existing = accounts.find(x => x.email === value)
    if (existing) return existing
    const account = { id: idFor(value), email: value }
    accounts.push(account)
    save(accounts)
    return account
  }
  const bind = email => {
    const value = normalize(email)
    const active = current()
    if (!validEmail(value) || (active.email && active.email !== value)) throw new Error('Entre com o e-mail selecionado para esta conta.')
    if (!active.email) save([{ id: 'principal', email: value }, ...read().filter(x => x.id !== 'principal')])
  }
  const dataDir = override || (selected === 'principal' ? root : path.join(root, 'accounts', selected))
  return { selected, current, list, add, bind, dataDir, isolated: !override }
}
module.exports = { createAccountProfiles }
