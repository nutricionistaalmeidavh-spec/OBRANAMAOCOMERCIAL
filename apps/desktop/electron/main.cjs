const { app, BrowserWindow, ipcMain, dialog, shell, Menu, safeStorage } = require('electron')
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
const { OnlineService } = require('./services/online-service.cjs')

let mainWindow
let services

function resolvePaths() {
  const dataDir = process.env.OBRA_NA_MAO_DATA_DIR || path.join(app.getPath('appData'), 'obra-na-mao-comercial')
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
