const fs = require('node:fs')
const path = require('node:path')

const development = path.resolve(__dirname, '../../../../packages/domain-core/index.cjs')
const packaged = path.join(process.resourcesPath || '', 'domain-core', 'index.cjs')
module.exports = require(fs.existsSync(development) ? development : packaged)
