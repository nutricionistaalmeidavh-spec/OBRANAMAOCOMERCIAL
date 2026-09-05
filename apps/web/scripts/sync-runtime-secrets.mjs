import { spawnSync } from 'node:child_process'

const isProductionWorkersBuild =
  process.env.WORKERS_CI === '1' && process.env.WORKERS_CI_BRANCH === 'main'

if (!isProductionWorkersBuild) process.exit(0)

const runtimeSecretNames = [
  'GEMINI_API_KEY',
  'GOOGLE_CLIENT_SECRET',
  'ASAAS_API_KEY',
  'ASAAS_WEBHOOK_TOKEN'
]

const secrets = Object.fromEntries(
  runtimeSecretNames
    .map((name) => [name, String(process.env[name] || '').trim()])
    .filter(([, value]) => value)
)

if (!secrets.GEMINI_API_KEY) {
  throw new Error(
    'GEMINI_API_KEY está configurada apenas como requisito de runtime, mas não está disponível no Workers Build para sincronização.'
  )
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(
  command,
  ['wrangler', 'secret', 'bulk', '--config', 'wrangler.jsonc'],
  {
    input: JSON.stringify(secrets),
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit']
  }
)

if (result.error) throw result.error
if (result.status !== 0) {
  throw new Error(`Falha ao sincronizar secrets de runtime no Cloudflare (exit ${result.status ?? 'unknown'}).`)
}

console.log(`[runtime-secrets] ${Object.keys(secrets).length} secret(s) sincronizado(s) com o Worker de produção.`)
