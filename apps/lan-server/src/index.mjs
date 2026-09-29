import os from 'node:os'
import path from 'node:path'
import { LanRepository } from './repository.mjs'
import { createLanServer, LAN_SERVER_VERSION } from './server.mjs'

const host = process.env.OBRA_NA_MAO_LAN_HOST?.trim() || '127.0.0.1'
const port = Number(process.env.OBRA_NA_MAO_LAN_PORT || 4732)
const dataDir = process.env.OBRA_NA_MAO_LAN_DATA_DIR?.trim() || path.join(os.homedir(), '.obra-na-mao-lan')

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('OBRA_NA_MAO_LAN_PORT deve ser uma porta TCP válida entre 1 e 65535.')
}

const repository = new LanRepository({ filename: path.join(dataDir, 'obra-na-mao-lan.sqlite') })
const server = createLanServer({ serverVersion: LAN_SERVER_VERSION, repository })

server.listen(port, host, () => {
  console.log(`Obra na Mão LAN Server ${LAN_SERVER_VERSION} disponível em http://${host}:${port}`)
  console.log(`Banco central: ${path.join(dataDir, 'obra-na-mao-lan.sqlite')}`)
})

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => {
    repository.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
