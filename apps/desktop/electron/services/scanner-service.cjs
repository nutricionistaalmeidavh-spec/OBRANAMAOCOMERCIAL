const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { PDFDocument } = require('pdf-lib')
const { sha256 } = require('./file-service.cjs')

const execFileAsync = promisify(execFile)
const MODES = new Set(['grayscale', 'color'])
const A4 = [595.28, 841.89]

// Abort emits an error before the process necessarily closes. Keep the operation
// locked until PowerShell has closed, so cancellation cannot race file cleanup.
function execFileUntilClosed(file, args, options) {
  return new Promise((resolve, reject) => {
    let result
    let failure
    const child = execFile(file, args, options, (error, stdout, stderr) => {
      failure = error
      if (failure) failure.stderr = stderr
      result = { stdout, stderr }
    })
    child.once('close', () => {
      if (failure) reject(failure)
      else resolve(result)
    })
  })
}

function normalizedFolderName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function signedDestinationFor(originalPath, pathApi = path) {
  if (!originalPath || typeof originalPath !== 'string') throw new Error('Documento original indisponível.')
  const originalFolder = pathApi.dirname(originalPath)
  const unsigned = normalizedFolderName(pathApi.basename(originalFolder)) === 'nao assinados'
  const signedFolder = unsigned ? pathApi.join(pathApi.dirname(originalFolder), 'Assinados') : pathApi.join(originalFolder, 'Assinados')
  const extension = pathApi.extname(originalPath)
  const stem = pathApi.basename(originalPath, extension)
  return pathApi.join(signedFolder, `${stem}_ASSINADO.pdf`)
}

function signedArchivePath(destination, version, pathApi = path) {
  const extension = pathApi.extname(destination) || '.pdf'
  const stem = pathApi.basename(destination, extension)
  const safeVersion = Math.max(1, Number(version) || 1)
  return pathApi.join(pathApi.dirname(destination), `${stem}_v${safeVersion}${extension}`)
}

function assertMode(mode) {
  const value = String(mode || 'grayscale')
  if (!MODES.has(value)) throw new Error('Modo de digitalização inválido.')
  return value
}

function publicSession(session) {
  return {
    sessionId: session.id,
    pages: session.pages.map((page, index) => ({ index, mode: page.mode, preview: `data:image/jpeg;base64,${fs.readFileSync(page.path).toString('base64')}` }))
  }
}

function managedDestination(fileService, destination) {
  const root = path.resolve(fileService.documentsDir)
  const target = path.resolve(destination)
  const relative = path.relative(root, target)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Destino fora da área gerenciada de documentos.')
  let ancestor = target
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor)
  const realRelative = path.relative(fs.realpathSync(root), fs.realpathSync(ancestor))
  if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) throw new Error('Destino fora da área gerenciada de documentos.')
  return target
}

function firstAvailableArchive(destination, preferredVersion) {
  let version = Math.max(1, Number(preferredVersion) || 1)
  let candidate = signedArchivePath(destination, version)
  while (fs.existsSync(candidate)) {
    version += 1
    candidate = signedArchivePath(destination, version)
  }
  return candidate
}

function wiaScript() {
  return `param(
  [Parameter(Mandatory=$true)][string]$Destination,
  [ValidateSet('grayscale','color')][string]$Mode='grayscale',
  [int]$Dpi=300
)
$ErrorActionPreference='Stop'
function Set-WiaProperty($Properties,[int]$PropertyId,$Value) {
  foreach($property in $Properties) {
    if([int]$property.PropertyID -eq $PropertyId) {
      $property.Value=$Value
      if([int]$property.Value -ne [int]$Value) { throw "O scanner não aceitou a configuração WIA $PropertyId." }
      return
    }
  }
  throw "O scanner não oferece a configuração WIA $PropertyId."
}
function Assert-WiaProperty($Properties,[int]$PropertyId,$Value) {
  foreach($property in $Properties) {
    if([int]$property.PropertyID -eq $PropertyId -and [int]$property.Value -eq [int]$Value) { return }
  }
  throw "O scanner alterou a configuração WIA $PropertyId. A captura foi interrompida."
}
function Set-WiaExtentMax($Properties,[int]$PropertyId) {
  foreach($property in $Properties) {
    if([int]$property.PropertyID -eq $PropertyId) {
      if($null -ne $property.SubTypeMax) { $property.Value=$property.SubTypeMax }
      return
    }
  }
}
try {
  $manager=New-Object -ComObject WIA.DeviceManager
  $scannerInfo=$null
  foreach($deviceInfo in $manager.DeviceInfos) {
    if([int]$deviceInfo.Type -eq 1) { $scannerInfo=$deviceInfo; break }
  }
  if($null -eq $scannerInfo) { throw 'Nenhum scanner compatível com WIA foi encontrado. Verifique se o scanner está ligado e se o driver Epson está instalado.' }
  $device=$scannerInfo.Connect()
  if($device.Items.Count -lt 1) { throw 'O scanner WIA não disponibilizou uma área de digitalização.' }
  $item=$device.Items.Item(1)
  $intent=$(if($Mode -eq 'color'){1}else{2})
  Set-WiaProperty $item.Properties 6146 $intent
  Set-WiaProperty $item.Properties 6147 $Dpi
  Set-WiaProperty $item.Properties 6148 $Dpi
  Set-WiaProperty $item.Properties 6149 0
  Set-WiaProperty $item.Properties 6150 0
  Set-WiaExtentMax $item.Properties 6151
  Set-WiaExtentMax $item.Properties 6152
  Assert-WiaProperty $item.Properties 6146 $intent
  Assert-WiaProperty $item.Properties 6147 $Dpi
  Assert-WiaProperty $item.Properties 6148 $Dpi
  $jpeg='{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'
  $image=$item.Transfer($jpeg)
  if(Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force }
  $image.SaveFile($Destination)
  if(!(Test-Path -LiteralPath $Destination)) { throw 'O scanner não retornou uma imagem.' }
  exit 0
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 42
}`
}

class ScannerService {
  constructor({ db, fileService, dataDir, platform = process.platform, acquirePage = null }) {
    this.db = db
    this.fileService = fileService
    this.dataDir = dataDir
    this.platform = platform
    this.sessions = new Map()
    this.busy = false
    this.disposed = false
    this.injectedAcquisition = typeof acquirePage === 'function'
    this.cacheDir = path.join(dataDir, '.scanner-cache')
    fs.mkdirSync(this.cacheDir, { recursive: true })
    this.powershellPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    this.acquirePage = acquirePage || ((options) => this.acquireWiaPage(options))
  }

  async capabilities() {
    const supported = this.platform === 'win32'
    let available = false
    if (supported && !this.disposed) {
      if (this.injectedAcquisition) available = true
      else if (fs.existsSync(this.powershellPath)) {
        try { available = await this.probeWia() } catch { available = false }
      }
    }
    return { platform: this.platform, supported, available, backend: supported ? 'wia' : null, dpi: 300, modes: ['grayscale', 'color'] }
  }

  async probeWia() {
    const command = "$ErrorActionPreference='Stop'; $manager=New-Object -ComObject WIA.DeviceManager; $count=0; foreach($device in $manager.DeviceInfos){if([int]$device.Type -eq 1){$count++}}; [Console]::Write($count)"
    const { stdout } = await execFileAsync(this.powershellPath, ['-NoProfile', '-STA', '-Command', command], { windowsHide: true, timeout: 10000, maxBuffer: 65536 })
    return Number(String(stdout).trim()) > 0
  }

  getSession(sessionId) {
    const session = this.sessions.get(String(sessionId || ''))
    if (!session || session.cancelled) throw new Error('Sessão de digitalização não encontrada ou já encerrada.')
    return session
  }

  async runOperation(session, action) {
    if (this.disposed) throw new Error('O serviço de digitalização foi encerrado.')
    if (this.busy) throw new Error('Há uma operação de digitalização em andamento. Aguarde sua conclusão.')
    this.busy = true
    session.controller = new AbortController()
    session.pending = (async () => {
      try { return await action(session.controller.signal) }
      finally { this.busy = false; session.controller = null }
    })()
    return session.pending
  }

  assertActive(signal) {
    if (signal.aborted) throw new Error('Digitalização cancelada.')
  }

  newPagePath(sessionId) {
    return path.join(this.cacheDir, `${sessionId}-${crypto.randomUUID()}.jpg`)
  }

  async capture(mode, signal) {
    mode = assertMode(mode)
    if (this.platform !== 'win32') throw new Error('A digitalização direta está disponível somente no Windows nesta versão.')
    const destination = this.newPagePath('scan')
    try {
      this.assertActive(signal)
      await this.acquirePage({ destination, mode, dpi: 300, signal })
      this.assertActive(signal)
      if (!fs.existsSync(destination) || fs.statSync(destination).size === 0) throw new Error('O scanner não retornou uma imagem válida.')
      return { path: destination, mode }
    } catch (error) {
      fs.rmSync(destination, { force: true })
      if (signal.aborted) throw new Error('Digitalização cancelada.')
      throw error
    }
  }

  async start({ mode = 'grayscale' } = {}) {
    const session = { id: crypto.randomUUID(), pages: [], cancelled: false }
    this.sessions.set(session.id, session)
    try {
      return await this.runOperation(session, async (signal) => {
        session.pages.push(await this.capture(mode, signal))
        return publicSession(session)
      })
    } catch (error) {
      await this.discard({ sessionId: session.id })
      throw error
    }
  }

  async addPage({ sessionId, mode = 'grayscale' } = {}) {
    const session = this.getSession(sessionId)
    return this.runOperation(session, async (signal) => {
      session.pages.push(await this.capture(mode, signal))
      return publicSession(session)
    })
  }

  async redoPage({ sessionId, pageIndex, mode = 'grayscale' } = {}) {
    const session = this.getSession(sessionId)
    const index = Number(pageIndex)
    if (!Number.isInteger(index) || index < 0 || index >= session.pages.length) throw new Error('Página de digitalização inválida.')
    return this.runOperation(session, async (signal) => {
      const replacement = await this.capture(mode, signal)
      const previous = session.pages[index]
      session.pages[index] = replacement
      fs.rmSync(previous.path, { force: true })
      return publicSession(session)
    })
  }

  clearSession(session) {
    for (const page of session.pages) fs.rmSync(page.path, { force: true })
    this.sessions.delete(session.id)
  }

  async discard({ sessionId } = {}) {
    const session = this.sessions.get(String(sessionId || ''))
    if (!session) return true
    session.cancelled = true
    session.controller?.abort()
    try { await session.pending } catch {}
    this.clearSession(session)
    return true
  }

  async acquireWiaPage({ destination, mode, dpi, signal }) {
    if (this.platform !== 'win32') throw new Error('A digitalização direta está disponível somente no Windows nesta versão.')
    if (!fs.existsSync(this.powershellPath)) throw new Error('Windows PowerShell 5.1 não encontrado. Não foi possível iniciar o WIA.')
    const scriptPath = path.join(this.cacheDir, 'wia-scan.ps1')
    const script = '\uFEFF' + wiaScript()
    if (!fs.existsSync(scriptPath) || fs.readFileSync(scriptPath, 'utf8') !== script) fs.writeFileSync(scriptPath, script, 'utf8')
    try {
      await execFileUntilClosed(this.powershellPath, ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Destination', destination, '-Mode', assertMode(mode), '-Dpi', String(dpi || 300)], { windowsHide: true, timeout: 180000, maxBuffer: 1024 * 1024, signal })
    } catch (error) {
      const detail = String(error?.stderr || error?.message || '').trim().split(/\r?\n/).filter(Boolean).slice(-1)[0]
      throw new Error(detail || 'Não foi possível digitalizar. Verifique o scanner Epson e tente novamente.')
    }
  }

  async makePdf(session, destination) {
    const pdf = await PDFDocument.create()
    for (const pageImage of session.pages) {
      const bytes = fs.readFileSync(pageImage.path)
      const jpegBytes = Uint8Array.from(bytes)
      let image
      try {
        image = await pdf.embedJpg(jpegBytes)
      } catch (error) {
        const header = bytes.subarray(0, 8).toString('hex')
        throw new Error(`Imagem digitalizada inválida (${path.basename(pageImage.path)}; header=${header}; bytes=${bytes.length}): ${error?.message || error}`)
      }
      const landscape = image.width > image.height
      const pageSize = landscape ? [A4[1], A4[0]] : A4
      const page = pdf.addPage(pageSize)
      const margin = 18
      const maxWidth = page.getWidth() - margin * 2
      const maxHeight = page.getHeight() - margin * 2
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height)
      const width = image.width * scale
      const height = image.height * scale
      page.drawImage(image, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height })
    }
    fs.writeFileSync(destination, await pdf.save())
  }

  latestSigned(documentId) {
    return this.db.db.prepare(`SELECT d.*,a.caminho AS arquivo_caminho,a.id AS arquivo_registro_id
      FROM documentos d JOIN arquivos a ON a.id=d.arquivo_id
      WHERE d.documento_origem_id=? AND d.status_assinatura='assinado' AND d.deleted_at IS NULL
      ORDER BY d.versao DESC,d.id DESC LIMIT 1`).get(documentId)
  }

  nextSignedVersion(documentId) {
    const row = this.db.db.prepare(`SELECT COALESCE(MAX(versao),0)+1 AS value FROM documentos
      WHERE documento_origem_id=? AND status_assinatura='assinado' AND deleted_at IS NULL`).get(documentId)
    return Number(row?.value || 1)
  }

  async saveSigned({ sessionId, documentId, replace = false } = {}) {
    const session = this.getSession(sessionId)
    return this.runOperation(session, (signal) => this.persistSigned(session, documentId, replace, signal))
  }

  async persistSigned(session, documentId, replace, signal) {
    if (!Number.isSafeInteger(documentId) || documentId <= 0 || typeof replace !== 'boolean') throw new Error('Parâmetros de salvamento inválidos.')
    if (!session.pages.length) throw new Error('Nenhuma página foi digitalizada.')
    const original = this.db.get('documentos', documentId)
    if (!original || original.deleted_at || original.status_assinatura === 'assinado' || !original.arquivo_id || !original.funcionario_id) throw new Error('Documento de funcionário inválido para digitalização.')
    const originalFile = this.db.get('arquivos', original.arquivo_id)
    if (!originalFile?.caminho || originalFile.deleted_at || !fs.existsSync(originalFile.caminho)) throw new Error('Arquivo original não encontrado.')
    this.fileService.assertManagedPath(originalFile.caminho)
    managedDestination(this.fileService, originalFile.caminho)
    const destination = managedDestination(this.fileService, signedDestinationFor(originalFile.caminho))
    let existingSigned = this.latestSigned(original.id)
    if (fs.existsSync(destination) && !replace) return { conflict: true, path: destination, existingDocumentId: existingSigned?.id || null }

    fs.mkdirSync(path.dirname(destination), { recursive: true })
    const part = `${destination}.part-${crypto.randomUUID()}`
    let archive = null
    let originalRemoved = false
    let published = false
    let document
    try {
      await this.makePdf(session, part)
      this.assertActive(signal)
      managedDestination(this.fileService, destination)
      existingSigned = this.latestSigned(original.id)
      if (fs.existsSync(destination) && !replace) return { conflict: true, path: destination, existingDocumentId: existingSigned?.id || null }
      document = this.db.db.transaction(() => {
        if (fs.existsSync(destination)) {
          const candidate = managedDestination(this.fileService, firstAvailableArchive(destination, existingSigned?.versao || 1))
          fs.copyFileSync(destination, candidate, fs.constants.COPYFILE_EXCL)
          archive = candidate
          fs.unlinkSync(destination)
          originalRemoved = true
          if (existingSigned?.arquivo_registro_id && path.resolve(existingSigned.arquivo_caminho) === path.resolve(destination)) {
            const file = this.db.get('arquivos', existingSigned.arquivo_registro_id)
            this.db.save('arquivos', { ...file, nome_original: path.basename(archive), nome_armazenado: path.basename(archive), caminho: archive })
          }
        }
        fs.copyFileSync(part, destination, fs.constants.COPYFILE_EXCL)
        published = true
        const file = this.db.save('arquivos', {
          nome_original: path.basename(destination), nome_armazenado: path.basename(destination), caminho: destination,
          tamanho: fs.statSync(destination).size, extensao: '.pdf', mime_type: 'application/pdf', hash: sha256(destination), origem: 'digitalizado_scanner'
        })
        return this.db.save('documentos', {
          arquivo_id: file.id,
          empresa_id: original.empresa_id,
          obra_id: original.obra_id,
          frente_id: original.frente_id,
          funcionario_id: original.funcionario_id,
          categoria: original.categoria,
          titulo: original.titulo,
          status_assinatura: 'assinado',
          documento_origem_id: original.id,
          versao: this.nextSignedVersion(original.id),
          observacoes: 'Versão assinada digitalizada pelo scanner no Fluxo DRE.'
        })
      })()
    } catch (error) {
      try {
        if (published) fs.rmSync(destination, { force: true })
        if (originalRemoved) fs.copyFileSync(archive, destination, fs.constants.COPYFILE_EXCL)
        if (archive) fs.rmSync(archive, { force: true })
      } catch (recoveryError) {
        throw new Error(`Falha ao salvar e restaurar o arquivo. A versão anterior foi preservada em ${archive || destination}. ${error.message}; ${recoveryError.message}`, { cause: error })
      }
      throw error
    } finally {
      try { fs.rmSync(part, { force: true }) } catch (error) { console.error('Não foi possível limpar o PDF temporário.', error) }
    }
    session.cancelled = true
    try { this.clearSession(session) } catch (error) { console.error('Não foi possível limpar a sessão salva.', error) }
    return { conflict: false, path: destination, document }
  }

  async dispose() {
    this.disposed = true
    await Promise.all([...this.sessions.keys()].map((sessionId) => this.discard({ sessionId })))
    const script = path.join(this.cacheDir, 'wia-scan.ps1')
    fs.rmSync(script, { force: true })
    if (fs.existsSync(this.cacheDir) && fs.readdirSync(this.cacheDir).length === 0) fs.rmdirSync(this.cacheDir)
  }
}

module.exports = { ScannerService, signedDestinationFor, signedArchivePath, wiaScript }
