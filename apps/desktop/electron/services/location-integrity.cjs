// Same location-chain rules as the Obra na Mão Server (single implementation).
const path = require('node:path')
const fs = require('node:fs')
const packaged = path.join(process.resourcesPath || '', 'lan-server', 'src', 'location-integrity.cjs')
const local = path.resolve(__dirname, '../../../lan-server/src/location-integrity.cjs')
module.exports = require(fs.existsSync(packaged) ? packaged : local)
