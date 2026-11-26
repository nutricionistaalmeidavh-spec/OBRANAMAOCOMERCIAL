// The field inbox core lives in the server package so the local Desktop and the
// Obra na Mão Server (LAN or own remote server) apply phone records the same way.
const path = require('node:path')
const fs = require('node:fs')
const packaged = path.join(process.resourcesPath || '', 'lan-server', 'src', 'field-inbox.cjs')
const local = path.resolve(__dirname, '../../../lan-server/src/field-inbox.cjs')
module.exports = require(fs.existsSync(packaged) ? packaged : local)
