const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('node:path')
const { DatabaseService } = require('./services/database.cjs')
const { FileService } = require('./services/file-service.cjs')
const { BackupService } = require('./services/backup-service.cjs')
const { ImportService } = require('./services/import-service.cjs')
const { DocumentService } = require('./services/document-service.cjs')
const { PayrollService } = require('./services/payroll-service.cjs')
const { DocumentRootService } = require('./services/document-root-service.cjs')
const { CatalogService } = require('./services/catalog-service.cjs')
const { TimeService } = require('./services/time-service.cjs')
const { WorkImportService } = require('./services/work-import-service.cjs')
const { UniversalImportService } = require('./services/universal-import-service.cjs')
const { WorksService } = require('./services/works-service.cjs')
const { PlanningService } = require('./services/planning-service.cjs')
const { FieldService } = require('./services/field-service.cjs')
const { ProcurementService } = require('./services/procurement-service.cjs')
const { ContractsService } = require('./services/contracts-service.cjs')
const { ProductService } = require('./services/product-service.cjs')
const { DemoDataService } = require('./services/demo-data-service.cjs')
const { UiPreferencesService } = require('./services/ui-preferences-service.cjs')
const { LanServer } = require('./services/lan-server.cjs')

let mainWindow
let services

function resolvePaths() {
  const dataDir = process.env.FLUXO_DRE_DATA_DIR || path.join(app.getPath('appData'), 'fluxo-dre')
  return { dataDir, documentsDir: path.join(dataDir, 'documentos'), migrationsDir: path.join(app.getAppPath(), 'database', 'migrations') }
}

function createServices() {
  const paths = resolvePaths()
  const db = new DatabaseService(paths)
  db.open()
  const files = new FileService({ documentsDir: paths.documentsDir, db })
  const documentRoot = new DocumentRootService({ db, files, defaultDir: paths.documentsDir })
  const product = new ProductService({ db })
  const uiPreferences = new UiPreferencesService({ db })
  return {
    paths, db, files, documentRoot,
    backup: new BackupService({ db, ...paths }),
    importer: new ImportService({ db }),
    documents: new DocumentService({ db, fileService: files, dialog }),
    payroll: new PayrollService({ db }),
    catalog: new CatalogService({ db }),
    time: new TimeService({ db, fileService: files }),
    workImport: new WorkImportService({ db }),
    universalImport: new UniversalImportService({ db }),
    works: new WorksService({ db }), planning: new PlanningService({ db }), field: new FieldService({ db }),
    product, uiPreferences, procurement: new ProcurementService({ db }), contracts: new ContractsService({ db, product }), demo: new DemoDataService({ db, product })
  }
}

function envelope(fn) {
  return async (_event, payload) => {
    try { return { ok: true, data: await fn(payload || {}) } }
    catch (error) {
      console.error(error)
      return { ok: false, error: { message: error?.message || 'Erro inesperado.' } }
    }
  }
}

function registerIpc() {
  ipcMain.handle('app:bootstrap', envelope(() => ({ dataPath: services.paths.dataDir, documentsPath: services.documentRoot.getRoot(), databasePath: services.db.dbPath, firstRun: services.db.list('empresas').length === 0, version: app.getVersion(), product: services.product.getEdition(), layout: services.uiPreferences.getLayout() })))
  ipcMain.handle('app:retry-database', envelope(() => { services.db.close(); services.db.open(); return true }))
  ipcMain.handle('app:get-layout', envelope(() => services.uiPreferences.getLayout()))
  ipcMain.handle('app:set-layout', envelope(({ layout }) => services.uiPreferences.setLayout(layout)))
  ipcMain.handle('entity:list', envelope(({ table, filters }) => services.db.list(table, filters)))
  ipcMain.handle('entity:get', envelope(({ table, id }) => services.db.get(table, id)))
  ipcMain.handle('entity:save', envelope(({ table, data }) => services.db.save(table, data)))
  ipcMain.handle('entity:remove', envelope(({ table, id }) => services.db.remove(table, id)))
  ipcMain.handle('dashboard:get', envelope((filters) => services.db.dashboard(filters)))
  ipcMain.handle('works:overview', envelope(({ obra_id }) => services.works.overview(obra_id)))
  ipcMain.handle('works:timeline', envelope(({ obra_id }) => services.works.timeline(obra_id)))
  ipcMain.handle('planning:overview', envelope(({ obra_id }) => services.planning.overview(obra_id)))
  ipcMain.handle('field:save-rdo', envelope((payload) => services.field.saveDailyReport(payload)))
  ipcMain.handle('procurement:summary', envelope(({ obra_id }) => services.procurement.summary(obra_id)))
  ipcMain.handle('procurement:create-order', envelope((payload) => services.procurement.createOrder(payload)))
  ipcMain.handle('procurement:receive-material', envelope((payload) => services.procurement.receiveMaterial(payload)))
  ipcMain.handle('procurement:move-stock', envelope((payload) => services.procurement.moveStock(payload)))
  ipcMain.handle('contracts:create', envelope((payload) => services.contracts.createReceivable(payload)))
  ipcMain.handle('contracts:addendum', envelope((payload) => services.contracts.createAddendum(payload)))
  ipcMain.handle('dre:get', envelope((filters) => services.db.dre(filters)))
  ipcMain.handle('accounts:payment', envelope(({ id, payment }) => services.db.accountPayment(id, payment)))
  ipcMain.handle('measurements:save', envelope((payload) => services.db.saveMeasurement(payload)))
  ipcMain.handle('works:import-spreadsheets', envelope(() => services.workImport.chooseAndImport()))
  ipcMain.handle('files:import-employee', envelope((payload) => services.files.importForEmployee(payload)))
  ipcMain.handle('files:import-measurement', envelope((payload) => services.files.importForMeasurement(payload)))
  ipcMain.handle('files:import-work-document', envelope((payload) => services.files.importForWorkDocument(payload)))
  ipcMain.handle('files:open', envelope(({ path: filePath }) => services.files.open(filePath)))
  ipcMain.handle('files:reveal', envelope(({ path: filePath }) => services.files.reveal(filePath)))
  ipcMain.handle('files:copy-path', envelope(({ path: filePath }) => services.files.copyPath(filePath)))
  ipcMain.handle('files:open-folder', envelope(() => services.documentRoot.openRoot()))
  ipcMain.handle('files:choose-root', envelope(() => services.documentRoot.chooseRoot()))
  ipcMain.handle('files:get-root', envelope(() => services.documentRoot.getRoot()))
  ipcMain.handle('documents:delete', envelope((payload) => services.files.deleteDocument(payload)))
  ipcMain.handle('documents:generate', envelope((payload) => services.documents.generate(payload)))
  ipcMain.handle('documents:templates', envelope(() => services.documents.listTemplates()))
  ipcMain.handle('documents:save-template', envelope((payload) => services.documents.saveTemplate(payload)))
  ipcMain.handle('documents:choose-local-template', envelope(() => services.documents.chooseLocalTemplate()))
  ipcMain.handle('documents:set-default-template', envelope((payload) => services.documents.setDefaultTemplate(payload)))
  ipcMain.handle('product:get-edition', envelope(() => services.product.getEdition()))
  ipcMain.handle('product:set-edition', envelope(({ edition }) => services.product.setEdition(edition)))
  ipcMain.handle('demo:seed', envelope(() => services.demo.seed()))
  ipcMain.handle('imports:preview', envelope(() => services.importer.chooseAndPreview()))
  ipcMain.handle('imports:commit', envelope(({ token }) => services.importer.commit(token)))
  ipcMain.handle('universal-import:choose', envelope(() => services.universalImport.choose()))
  ipcMain.handle('universal-import:preview', envelope(({ token, options }) => services.universalImport.preview(token, options)))
  ipcMain.handle('universal-import:commit', envelope(({ token, options }) => services.universalImport.commit(token, options)))
  ipcMain.handle('backup:create', envelope(() => services.backup.create()))
  ipcMain.handle('backup:restore', envelope(() => services.backup.restore()))
  ipcMain.handle('backup:open-data-folder', envelope(() => services.backup.openDataFolder()))
  ipcMain.handle('payroll:employee', envelope((payload) => services.payroll.getEmployee(payload)))
  ipcMain.handle('payroll:save-variable', envelope((payload) => services.payroll.saveVariable(payload)))
  ipcMain.handle('payroll:remove-variable', envelope(({ id }) => services.payroll.removeVariable(id)))
  ipcMain.handle('payroll:confirm', envelope(async (payload) => {
    const payment = services.payroll.confirm(payload)
    const documents = Number(payload.quinzena) === 1 ? await services.time.generateDocuments({ funcionario_id: payload.funcionario_id, competencia: payload.competencia, paymentDate: payload.data }) : null
    return { ...payment, documents }
  }))
  ipcMain.handle('payroll:pending', envelope(({ competencia }) => services.payroll.pending(competencia)))
  ipcMain.handle('time:get', envelope((payload) => services.time.get(payload)))
  ipcMain.handle('time:auto-fill', envelope((payload) => services.time.autoFill(payload)))
  ipcMain.handle('time:save', envelope((payload) => services.time.save(payload)))
  ipcMain.handle('time:generate', envelope((payload) => services.time.generateDocuments(payload)))
  ipcMain.handle('time:generate-all', envelope((payload) => services.time.generateForAll(payload)))
  ipcMain.handle('catalog:list', envelope(() => services.catalog.list()))
  ipcMain.handle('catalog:save-cargo', envelope((data) => services.catalog.saveCargo(data)))
  ipcMain.handle('catalog:save-benefit', envelope((data) => services.catalog.saveBenefit(data)))
  ipcMain.handle('catalog:save-link', envelope((data) => services.catalog.saveLink(data)))
  ipcMain.handle('catalog:deactivate', envelope((data) => services.catalog.deactivate(data.type, data.id)))
}

function fallbackPage(message, details = '') {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial;background:#f3f5f8;color:#152033;display:grid;place-items:center;height:100vh;margin:0}.card{width:min(650px,90vw);background:white;padding:32px;border-radius:14px;box-shadow:0 10px 30px #0001}button{background:#2f67d8;color:white;border:0;border-radius:8px;padding:11px 16px}</style></head><body><div class="card"><h1>O Fluxo DRE não conseguiu iniciar</h1><p>${message}</p><details><summary>Detalhes técnicos</summary>${details}</details><button onclick="location.reload()">Tentar novamente</button></div></body></html>`)}`
}

async function createWindow() {
  Menu.setApplicationMenu(null)
  mainWindow = new BrowserWindow({ width: 1440, height: 900, minWidth: 1024, minHeight: 700, backgroundColor: '#f3f5f8', show: false, autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' } })
  mainWindow.webContents.on('will-navigate', (event, url) => { const allowed = process.env.VITE_DEV_SERVER_URL ? url.startsWith(process.env.VITE_DEV_SERVER_URL) : url.startsWith('file:'); if (!allowed) event.preventDefault() })
  mainWindow.once('ready-to-show', () => mainWindow.show())
  try { if (process.env.VITE_DEV_SERVER_URL) await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL); else await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html')) }
  catch (error) { await mainWindow.loadURL(fallbackPage('A interface não pôde ser carregada.', error.stack)); mainWindow.show() }
}

app.whenReady().then(async () => {
  try { services = createServices(); registerIpc(); await createWindow() }
  catch (error) { console.error(error); mainWindow = new BrowserWindow({ width: 900, height: 650, backgroundColor: '#f3f5f8' }); await mainWindow.loadURL(fallbackPage('Não foi possível abrir o banco de dados local.', error.stack)) }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => services?.db?.close())
process.on('uncaughtException', (error) => { console.error(error); dialog.showErrorBox('Erro inesperado', error.message) })
process.on('unhandledRejection', (error) => console.error(error))
