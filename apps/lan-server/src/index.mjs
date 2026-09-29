import { createLanServer, LAN_SERVER_VERSION } from './server.mjs'

const host = process.env.OBRA_NA_MAO_LAN_HOST?.trim() || '127.0.0.1'
const port = Number(process.env.OBRA_NA_MAO_LAN_PORT || 4732)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('OBRA_NA_MAO_LAN_PORT deve ser uma porta TCP válida entre 1 e 65535.')
}

const server = createLanServer({ serverVersion: LAN_SERVER_VERSION })
server.listen(port, host, () => {
  console.log(`Obra na Mão LAN Server ${LAN_SERVER_VERSION} disponível em http://${host}:${port}`)
})

function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
