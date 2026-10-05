const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, safeStorage } = require('electron')
const path = require('node:path')
const { DatabaseService } = require('./services/database-safe.cjs')
const { DataAccessService } = require('./services/data-access-service.cjs')
const { StorageConnectionService } = require('./services/storage-connection-service.cjs')
const { ServerDiscoveryService } = require('./services/server-discovery-service.cjs')
const { ServerReconnectService } = require('./services/server-reconnect-service.cjs')
const { ModuleStorageStateService } = require('./services/module-storage-state-service.cjs')
const { ModuleMigrationService } = require('./services/module-migration-service.cjs')
const { LanCredentialService } = require('./services/lan-credential-service.cjs')
const { LanHostService } = require('./services/lan-host-service.cjs')
const { LanSetupService } = require('./services/lan-setup-service.cjs')
const { FileService } = require('./services/file-service.cjs')
const { ManagedDirectoryService } = require('./services/managed-directory-service.cjs')
const { DocumentExplorerContextService } = require('./services/document-explorer-context-service.cjs')
const { syncRegisteredPaths, removeRegisteredPaths } = require('./services/file-registry-paths.cjs')
const { BackupService } = require('./services/backup-service.cjs')
const { ImportService } = require('./services/import-service.cjs')
const { DocumentService } = require('./services/document-service.cjs')
const { PayrollService } = require('./services/payroll-service.cjs')
const { DocumentRootService } = require('./services/document-root-service.cjs')
const { CatalogService } = require('./services/catalog-service.cjs')
const { RhCatalogSourceService } = require('./services/rh-catalog-source-service.cjs')
const { RhSourceService } = require('./services/rh-source-service.cjs')
const { RhDocumentService } = require('./services/rh-document-service.cjs')
const { TimeService } = require('./services/time-service.cjs')
const { ScannerService } = require('./services/scanner-service.cjs')
const { WorkImportService } = require('./services/work-import-service.cjs')
const { UniversalImportService } = require('./services/universal-import-service.cjs')
const { WorksService } = require('./services/works-service.cjs')
const { PlanningService } = require('./services/planning-service.cjs')
const { PlanningSourceService } = require('./services/planning-source-service.cjs')
const { FinanceSourceService } = require('./services/finance-source-service.cjs')
const { MeasurementSourceService } = require('./services/measurement-source-service.cjs')
const { FieldService } = require('./services/field-service.cjs')
const { FieldSourceService } = require('./services/field-source-service.cjs')
const { ProcurementService } = require('./services/procurement-service.cjs')
const { ProcurementSourceService } = require('./services/procurement-source-service.cjs')
const { ContractsService } = require('./services/contracts-service.cjs')
const { ContractsSourceService } = require('./services/contracts-source-service.cjs')
const { ProductService } = require('./services/product-service.cjs')
const { DemoDataService } = require('./services/demo-data-service.cjs')
const { UiPreferencesService } = require('./services/ui-preferences-service.cjs')
const { OnlineService } = require('./services/online-service.cjs')
const { CanonicalStorageOnboardingService } = require('./services/canonical-storage-onboarding-service.cjs')
const { SyncCoordinator } = require('./services/sync-coordinator.cjs')
const { OperationalSyncDataProvider } = require('./services/lan-sync-data-provider.cjs')

let mainWindow
let tray
let services
let connectionMaintenance = false
let quitting = false

async function withSyncStopped(operation, restart = true) {
  if (connectionMaintenance) throw new Error('Aguarde a manutenção da conexão terminar.')
  connectionMaintenance = true
  try {
    await services.sync.stop()
    return await operation()
  } finally {
    connectionMaintenance = false
    if (restart && !quitting) services.sync.start()
  }
}

function requireSyncAvailable() {
  if (connectionMaintenance || quitting) throw new Error('Sincronização pausada durante manutenção.')
}

function resolvePaths() {
  const dataDir = process.env.OBRA_NA_MAO_DATA_DIR || path.join(app.getPath('appData'), 'obra-na-mao-comercial')
  return { dataDir, documentsDir: path.join(dataDir, 'documentos'), migrationsDir: path.join(app.getAppPath(), 'database', 'migrations') }
}

function resolveLanServerEntry() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'lan-server', 'src', 'index.mjs')
    : path.join(app.getAppPath(), '..', 'lan-server', 'src', 'index.mjs')
}

function createServices() {
  const paths = resolvePaths()
  const db = new DatabaseService(paths)
  db.open()
  const storage = new StorageConnectionService({ db })
  const serverDiscovery = new ServerDiscoveryService()
  const lanCredentials = new LanCredentialService({ dataDir: paths.dataDir, safeStorage })
  const serverReconnect = new ServerReconnectService({ storage, discovery: serverDiscovery, credentials: lanCredentials })
  const dataAccess = new DataAccessService({ db, storage, credentials: lanCredentials })
  const moduleStorage = new ModuleStorageStateService({ database: db, storage, lanClient: dataAccess.remote })
  dataAccess.moduleStorage = moduleStorage
  const localField = new FieldService({ db })
  const field = new FieldSourceService({ local: localField, lanClient: dataAccess.remote, moduleStorage })
  const localPlanning = new PlanningService({ db })
  const planning = new PlanningSourceService({ local: localPlanning, lanClient: dataAccess.remote, moduleStorage })
  const finance = new FinanceSourceService({ local: db, lanClient: dataAccess.remote, moduleStorage })
  const measurements = new MeasurementSourceService({ local: db, lanClient: dataAccess.remote, moduleStorage })
  const syncDataProvider = new OperationalSyncDataProvider({ storage, lanClient: dataAccess.remote, database: db })
  const files = new FileService({ documentsDir: paths.documentsDir, db, dataAccess, lanClient:dataAccess.remote, moduleStorage, storage })
  const localPayroll = new PayrollService({ db })
  const localTime = new TimeService({ db, fileService: files })
  const rh = new RhSourceService({ localPayroll, localTime, lanClient: dataAccess.remote, moduleStorage })
  const catalog = new RhCatalogSourceService({ local: new CatalogService({ db }), dataAccess, moduleStorage })
  const rhDocuments = new RhDocumentService({ rh, localTime, fileService: files, dataAccess })
  const time = {
    get: payload => rh.timeGet(payload),
    autoFill: payload => rh.timeAutoFill(payload),
    save: payload => rh.timeSave(payload),
    generateDocuments: payload => rhDocuments.generateDocuments(payload),
    generateForAll: payload => rhDocuments.generateForAll(payload)
  }
  const documentRoot = new DocumentRootService({ db, files, defaultDir: paths.documentsDir })
  const explorer = new ManagedDirectoryService({
    roots: { documents: () => documentRoot.getRoot() }, shell, dialog,
    onPathChanged: (previous, next) => syncRegisteredPaths(db, previous, next),
    onPathRemoved: (target) => removeRegisteredPaths(db, target)
  })
  const explorerContext = new DocumentExplorerContextService({ db, explorer, rootId: 'documents' })
  const product = new ProductService({ db })
  const localProcurement = new ProcurementService({ db })
  const procurement = new ProcurementSourceService({ local: localProcurement, lanClient: dataAccess.remote, moduleStorage })
  const localContracts = new ContractsService({ db, product })
  const contracts = new ContractsSourceService({ local: localContracts, lanClient: dataAccess.remote, moduleStorage, dataAccess, product })
  const uiPreferences = new UiPreferencesService({ db })
  const online = new OnlineService({ dataDir: paths.dataDir, shell, safeStorage })
  const sync = new SyncCoordinator({
    database: db,
    online,
    dataProvider: syncDataProvider,
    onStateChanged: state => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('online:sync-state-changed', state)
    }
  })
  const lanHost = new LanHostService({
    storage,
    dataDir: paths.dataDir,
    cloudBaseUrl: () => online.state().baseUrl,
    serverEntry: resolveLanServerEntry()
  })
  const lanSetup = new LanSetupService({ storage, credentials: lanCredentials, online, setupCodeProvider: () => lanHost.setupCode() })
  const canonicalStorage = new CanonicalStorageOnboardingService({ online, storage, serverDiscovery, lanSetup, refreshCapabilities: () => moduleStorage.refreshCapabilities() })
  const backup = new BackupService({ db, ...paths })
  const migration = new ModuleMigrationService({ database: db, storage, moduleStorage, lanClient: dataAccess.remote, backup, appVersion: app.getVersion() })
  return {
    paths, db, dataAccess, storage, serverDiscovery, serverReconnect, moduleStorage, migration, lanCredentials, lanHost, lanSetup, files, documentRoot, explorer, explorerContext,
    backup, canonicalStorage,
    importer: new ImportService({ db }),
    documents: new DocumentService({ db, fileService: files, dialog, dataAccess, moduleStorage }),
    payroll: rh,
    catalog,
    time,
    scanner: new ScannerService({ db, fileService: files, dataDir: paths.dataDir }),
    workImport: new WorkImportService({ db }),
    universalImport: new UniversalImportService({ db }),
    works: new WorksService({ db, dataAccess, moduleStorage }), planning, field, finance, measurements,
    product, uiPreferences, procurement, contracts, demo: new DemoDataService({ db, product }), online, sync
  }
}

function envelope(fn) {
  return async (_event, payload) => {
    try { return { ok: true, data: await fn(payload || {}) } }
    catch (error) {
      console.error(error)
      return {
        ok: false,
        error: {
          message: error?.message || 'Erro inesperado.',
          code: error?.code,
          status: error?.status,
          resourceType: error?.resourceType,
          resourceId: error?.resourceId,
          expectedRevision: error?.expectedRevision,
          currentRevision: error?.currentRevision,
          current: error?.current,
          details: error?.details
        }
      }
    }
  }
}

function isLanHostMode() {
  return services?.storage?.state?.().operationalMode === 'lan-host'
}

function trayIcon() {
  return path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return createWindow()
  mainWindow.show()
  mainWindow.restore?.()
  mainWindow.focus()
}

function ensureTray() {
  if (tray || !isLanHostMode()) return tray
  tray = new Tray(trayIcon())
  tray.setToolTip('Obra na Mão — servidor local ativo')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Obra na Mão', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ]))
  tray.on('double-click', () => showMainWindow())
  return tray
}

function destroyTray() {
  tray?.destroy?.()
  tray = null
}

async function refreshModuleCapabilitiesSafe() {
  try { return await services.moduleStorage.refreshCapabilities() }
  catch {
    return {
      core: services.moduleStorage.state('core'),
      operation: services.moduleStorage.state('operation'),
      planning: services.moduleStorage.state('planning'),
      finance: services.moduleStorage.state('finance'),
      rh: services.moduleStorage.state('rh'),
      documents: services.moduleStorage.state('documents')
    }
  }
}

async function configureStorage(payload) {
  const previous = services.storage.state()
  const requestedOperational = payload.operationalMode || (payload.mode === 'server' ? 'lan-client' : 'local')
  if (previous.operationalMode === 'lan-host' && requestedOperational !== 'lan-host') await services.lanHost.stop()
  const state = services.storage.configure(payload)
  if (state.operationalMode === 'lan-host') {
    const host = await services.lanHost.start()
    if (!host.running && host.lastError) throw new Error(host.lastError)
    ensureTray()
  } else {
    destroyTray()
  }
  await refreshModuleCapabilitiesSafe()
  return state
}

async function completeCanonicalStorage(result = {}, options = {}) {
  const required = services.online.state().storageRequired
  if (!required) return result
  const storage = await services.canonicalStorage.complete(options)
  return { ...result, ...storage, storageRequired: storage.storageRequired || null }
}

async function connectStorageAddress(address, operationalMode = 'lan-client') {
  const previous = services.storage.state()
  let rejectServerId = null
  if (previous.operationalMode === 'lan-host') {
    try {
      const currentServer = await services.lanSetup.status()
      rejectServerId = currentServer?.serverId || null
    } catch {}
  }
  const result = await services.storage.connectAddress(address, { rejectServerId, operationalMode })
  if (previous.operationalMode === 'lan-host') await services.lanHost.stop()
  destroyTray()
  await refreshModuleCapabilitiesSafe()
  return result
}

function registerIpc() {
  ipcMain.handle('app:bootstrap', envelope(() => ({ dataPath: services.paths.dataDir, documentsPath: services.documentRoot.getRoot(), databasePath: services.db.dbPath, firstRun: services.db.list('empresas').length === 0, version: app.getVersion(), product: services.product.getEdition(), layout: services.uiPreferences.getLayout() })))
  ipcMain.handle('app:retry-database', envelope(() => withSyncStopped(() => { services.db.close(); services.db.open(); return true })))
  ipcMain.handle('app:get-layout', envelope(() => services.uiPreferences.getLayout()))
  ipcMain.handle('app:set-layout', envelope(({ layout }) => services.uiPreferences.setLayout(layout)))
  ipcMain.handle('storage:state', envelope(() => services.storage.state()))
  ipcMain.handle('storage:configure', envelope((payload) => configureStorage(payload)))
  ipcMain.handle('storage:test-connection', envelope(() => services.storage.testConnection()))
  ipcMain.handle('storage:discover-servers', envelope(() => services.serverDiscovery.discover()))
  ipcMain.handle('storage:probe-address', envelope(({ address, operationalMode }) => services.storage.probeAddress(address, { operationalMode })))
  ipcMain.handle('storage:connect-address', envelope(({ address, operationalMode }) => connectStorageAddress(address, operationalMode)))
  ipcMain.handle('storage:module-state', envelope(({ module }) => services.moduleStorage.state(module)))
  ipcMain.handle('storage:refresh-module-capabilities', envelope(() => services.moduleStorage.refreshCapabilities()))
  ipcMain.handle('storage:migration-preflight', envelope(({ module }) => services.migration.preflight(module)))
  ipcMain.handle('storage:migration-status', envelope(({ module }) => services.migration.status(module)))
  ipcMain.handle('storage:migrate-module', envelope(({ module }) => withSyncStopped(() => services.migration.migrate(module))))
  ipcMain.handle('storage:rollback-module-migration', envelope(({ module }) => withSyncStopped(() => services.migration.rollback(module))))
  ipcMain.handle('lan:host-state', envelope(() => services.lanHost.state()))
  ipcMain.handle('lan:host-start', envelope(async () => { const result = await services.lanHost.start(); if (isLanHostMode()) ensureTray(); return result }))
  ipcMain.handle('lan:host-stop', envelope(() => services.lanHost.stop()))
  ipcMain.handle('lan:status', envelope(() => services.lanSetup.status()))
  ipcMain.handle('lan:reconnect', envelope(() => services.serverReconnect.reconnect()))
  ipcMain.handle('lan:operations-status', envelope(() => services.lanSetup.operationsStatus()))
  ipcMain.handle('lan:list-backups', envelope(() => services.lanSetup.listBackups()))
  ipcMain.handle('lan:create-backup', envelope(({ reason }) => services.lanSetup.createBackup({ reason })))
  ipcMain.handle('lan:test-backup', envelope(({ backupId }) => services.lanSetup.testBackup({ backupId })))
  ipcMain.handle('lan:pre-upgrade-backup', envelope(() => services.lanSetup.preUpgradeBackup()))
  ipcMain.handle('lan:restore-backup', envelope(({ backupId }) => services.lanSetup.restoreBackup({ backupId })))
  ipcMain.handle('lan:claim-host', envelope(async ({ setupCode }) => {
    const localSetupCode = setupCode || services.lanHost.state().setupCode
    const result = await services.lanSetup.claimHostedServer({ setupCode: localSetupCode })
    services.lanHost.clearSetupCode?.()
    await refreshModuleCapabilitiesSafe()
    return result
  }))
  ipcMain.handle('lan:pair', envelope(async ({ code }) => {
    const result = await services.lanSetup.pair({ code })
    await refreshModuleCapabilitiesSafe()
    return result
  }))
  ipcMain.handle('lan:disconnect', envelope(() => services.lanSetup.disconnect()))
  ipcMain.handle('lan:admin-status', envelope(() => services.lanSetup.adminStatus()))
  ipcMain.handle('lan:create-pairing', envelope(({ memberId }) => services.lanSetup.createPairing({ memberId })))
  ipcMain.handle('lan:list-devices', envelope(async () => { const result = await services.lanSetup.listDevices(); return Array.isArray(result) ? result : (result.devices || []) }))
  ipcMain.handle('lan:set-device-status', envelope((payload) => services.lanSetup.setDeviceStatus(payload)))
  ipcMain.handle('lan:refresh-identity', envelope(() => services.lanSetup.refreshIdentity()))
  ipcMain.handle('lan:start-at-login-state', envelope(() => ({ enabled: app.getLoginItemSettings().openAtLogin === true })))
  ipcMain.handle('lan:set-start-at-login', envelope(({ enabled }) => { app.setLoginItemSettings({ openAtLogin: enabled === true }); return { enabled: app.getLoginItemSettings().openAtLogin === true } }))
  ipcMain.handle('entity:list', envelope(({ table, filters }) => services.dataAccess.list(table, filters)))
  ipcMain.handle('entity:get', envelope(({ table, id }) => services.dataAccess.get(table, id)))
  ipcMain.handle('entity:save', envelope(({ table, data }) => services.dataAccess.save(table, data)))
  ipcMain.handle('entity:remove', envelope(({ table, id, revision }) => services.dataAccess.remove(table, id, revision)))
  ipcMain.handle('dashboard:get', envelope((filters) => services.finance.dashboard(filters)))
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
  ipcMain.handle('dre:get', envelope((filters) => services.finance.dre(filters)))
  ipcMain.handle('accounts:payment', envelope(({ id, payment }) => services.finance.accountPayment(id, payment)))
  ipcMain.handle('measurements:save', envelope((payload) => services.measurements.saveWithItems(payload)))
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
  ipcMain.handle('explorer:list', envelope((payload) => services.explorer.list(payload)))
  ipcMain.handle('explorer:preview', envelope((payload) => services.explorer.preview(payload)))
  ipcMain.handle('explorer:open', envelope((payload) => services.explorer.open(payload)))
  ipcMain.handle('explorer:create-folder', envelope((payload) => services.explorer.createFolder(payload)))
  ipcMain.handle('explorer:rename', envelope((payload) => services.explorer.rename(payload)))
  ipcMain.handle('explorer:move', envelope((payload) => services.explorer.move(payload)))
  ipcMain.handle('explorer:remove', envelope((payload) => services.explorer.remove(payload)))
  ipcMain.handle('explorer:import', envelope((payload) => services.explorer.importFiles(payload)))
  ipcMain.handle('explorer:pick-import', envelope((payload) => services.explorer.pickImportFiles(payload)))
  ipcMain.handle('explorer:context', envelope((payload) => services.explorerContext.context(payload)))
  ipcMain.handle('explorer:index', envelope((payload) => services.explorerContext.index(payload)))
  ipcMain.handle('explorer:move-to-signed', envelope((payload) => services.explorerContext.moveToSigned(payload)))
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
  ipcMain.handle('backup:restore', envelope(() => withSyncStopped(async () => {
    const result = await services.backup.restore()
    if (result?.restored) services.db.db.prepare('DELETE FROM desktop_sync_scope WHERE id=1').run()
    return result
  })))
  ipcMain.handle('backup:open-data-folder', envelope(() => services.backup.openDataFolder()))
  ipcMain.handle('payroll:employee', envelope((payload) => services.payroll.getEmployee(payload)))
  ipcMain.handle('payroll:save-variable', envelope((payload) => services.payroll.saveVariable(payload)))
  ipcMain.handle('payroll:remove-variable', envelope(({ id }) => services.payroll.removeVariable(id)))
  ipcMain.handle('payroll:confirm', envelope(async (payload) => {
    const payment = await services.payroll.confirm(payload)
    let documents = null, documentError = null
    if (Number(payload.quinzena) === 1) {
      try { documents = await services.time.generateDocuments({ funcionario_id: payload.funcionario_id, competencia: payload.competencia, paymentDate: payload.data }) }
      catch (error) { documentError = error instanceof Error ? error.message : String(error) }
    }
    return { ...payment, documents, documentError }
  }))
  ipcMain.handle('payroll:pending', envelope(({ competencia }) => services.payroll.pending(competencia)))
  ipcMain.handle('time:get', envelope((payload) => services.time.get(payload)))
  ipcMain.handle('time:auto-fill', envelope((payload) => services.time.autoFill(payload)))
  ipcMain.handle('time:save', envelope((payload) => services.time.save(payload)))
  ipcMain.handle('time:generate', envelope((payload) => services.time.generateDocuments(payload)))
  ipcMain.handle('time:generate-all', envelope((payload) => services.time.generateForAll(payload)))
  ipcMain.handle('scanner:capabilities', envelope(() => services.scanner.capabilities()))
  ipcMain.handle('scanner:start', envelope((payload) => services.scanner.start(payload)))
  ipcMain.handle('scanner:add-page', envelope((payload) => services.scanner.addPage(payload)))
  ipcMain.handle('scanner:redo-page', envelope((payload) => services.scanner.redoPage(payload)))
  ipcMain.handle('scanner:discard', envelope((payload) => services.scanner.discard(payload)))
  ipcMain.handle('scanner:save-signed', envelope((payload) => services.scanner.saveSigned(payload)))
  ipcMain.handle('catalog:list', envelope(() => services.catalog.list()))
  ipcMain.handle('catalog:save-cargo', envelope((data) => services.catalog.saveCargo(data)))
  ipcMain.handle('catalog:save-compensation-policy', envelope((data) => services.catalog.saveCompensationPolicy(data)))
  ipcMain.handle('catalog:save-benefit', envelope((data) => services.catalog.saveBenefit(data)))
  ipcMain.handle('catalog:save-link', envelope((data) => services.catalog.saveLink(data)))
  ipcMain.handle('catalog:deactivate', envelope((data) => services.catalog.deactivate(data.type, data.id)))
  ipcMain.handle('online:state', envelope(() => services.online.state()))
  ipcMain.handle('online:password-auth', envelope((payload) => withSyncStopped(async () => completeCanonicalStorage(await services.online.passwordAuth(payload)))))
  ipcMain.handle('online:password-setup', envelope((payload) => withSyncStopped(async () => completeCanonicalStorage(await services.online.completePasswordLink(payload)))))
  ipcMain.handle('online:set-base-url', envelope(({ baseUrl }) => withSyncStopped(() => services.online.setBaseUrl(baseUrl))))
  ipcMain.handle('online:start', envelope((payload) => services.online.start(payload)))
  ipcMain.handle('online:status', envelope(() => withSyncStopped(async () => completeCanonicalStorage(await services.online.status()))))
  ipcMain.handle('online:complete-storage', envelope((payload) => withSyncStopped(() => completeCanonicalStorage({ linked: false }, payload))))
  ipcMain.handle('online:session', envelope(() => services.online.session()))
  ipcMain.handle('online:set-storage-topology', envelope((payload) => services.online.setStorageTopology(payload)))
  ipcMain.handle('online:members-list', envelope(() => services.online.membersList()))
  ipcMain.handle('online:member-save', envelope((payload) => services.online.memberSave(payload)))
  ipcMain.handle('online:member-status', envelope(({ memberId, status }) => services.online.memberStatus(memberId, status)))
  ipcMain.handle('online:company-devices', envelope(() => services.online.companyDevices()))
  ipcMain.handle('online:revoke-company-device', envelope(({ deviceId }) => services.online.revokeCompanyDevice(deviceId)))
  ipcMain.handle('online:disconnect', envelope(() => withSyncStopped(() => services.online.disconnect())))
  ipcMain.handle('online:sync-state', envelope(() => services.sync.state()))
  ipcMain.handle('online:sync-configure', envelope((scope) => withSyncStopped(() => services.sync.configure(scope))))
  ipcMain.handle('online:sync-now', envelope(() => { requireSyncAvailable(); return services.sync.run({ retryNow: true }) }))
  ipcMain.handle('online:sync-resolve-local', envelope(({ id, resolution }) => withSyncStopped(() => services.sync.resolveLocalConflict(id, resolution))))
  ipcMain.handle('online:sync-pull', envelope(({ sinceRevision }) => services.online.syncPull(sinceRevision)))
  ipcMain.handle('online:sync-push', envelope(({ changes }) => services.online.syncPush(changes)))
  ipcMain.handle('online:mobile-summary', envelope(({ summary }) => services.online.publishMobileSummary(summary)))
  ipcMain.handle('online:finance-read', envelope(({ view }) => services.online.financeRead(view)))
  ipcMain.handle('online:finance-write', envelope(({ action, input }) => services.online.financeWrite(action, input)))
  ipcMain.handle('online:finance-reference', envelope(({ obligations }) => services.online.publishFinanceReference(obligations)))
  ipcMain.handle('online:ai-analyze', envelope((payload) => services.online.aiAnalyze(payload)))
  ipcMain.handle('online:conflicts', envelope(() => services.online.conflicts()))
  ipcMain.handle('online:resolve-conflict', envelope(({ conflictId, resolution }) => services.online.resolveConflict(conflictId, resolution)))
}

function fallbackPage(message, details = '') {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial;background:#f3f5f8;color:#152033;display:grid;place-items:center;height:100vh;margin:0}.card{width:min(650px,90vw);background:white;padding:32px;border-radius:14px;box-shadow:0 10px 30px #0001}button{background:#2f67d8;color:white;border:0;border-radius:8px;padding:11px 16px}</style></head><body><div class="card"><h1>O Obra na Mão Desktop não conseguiu iniciar</h1><p>${message}</p><details><summary>Detalhes técnicos</summary>${details}</details><button onclick="location.reload()">Tentar novamente</button></div></body></html>`)}`
}

async function createWindow() {
  Menu.setApplicationMenu(null)
  mainWindow = new BrowserWindow({ icon: trayIcon(), width: 1440, height: 900, minWidth: 1024, minHeight: 700, backgroundColor: '#f3f5f8', show: false, autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' } })
  mainWindow.webContents.on('will-navigate', (event, url) => { const allowed = process.env.VITE_DEV_SERVER_URL ? url.startsWith(process.env.VITE_DEV_SERVER_URL) : url.startsWith('file:'); if (!allowed) event.preventDefault() })
  mainWindow.on('close', (event) => {
    if (!quitting && isLanHostMode()) {
      event.preventDefault()
      mainWindow.hide()
      ensureTray()
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow.show())
  try { if (process.env.VITE_DEV_SERVER_URL) await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL); else await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html')) }
  catch (error) { await mainWindow.loadURL(fallbackPage('A interface não pôde ser carregada.', error.stack)); mainWindow.show() }
}

app.whenReady().then(async () => {
  try {
    services = createServices()
    registerIpc()
    if (isLanHostMode()) {
      await services.lanHost.start()
      ensureTray()
    } else if (['lan-client','remote'].includes(services.storage.state().operationalMode)) {
      try { await services.serverReconnect.reconnect() } catch (error) { console.warn('Falha ao reconectar servidor salvo:', error?.message || error) }
    }
    if (services.online.state().storageRequired) {
      try { await services.canonicalStorage.complete() } catch (error) { console.warn('Fonte operacional da empresa ainda indisponível:', error?.message || error) }
    }
    await refreshModuleCapabilitiesSafe()
    await createWindow()
    services.sync.start()
  }
  catch (error) { console.error(error); mainWindow = new BrowserWindow({ icon: trayIcon(), width: 900, height: 650, backgroundColor: '#f3f5f8' }); await mainWindow.loadURL(fallbackPage('Não foi possível abrir o Obra na Mão.', error.stack)) }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else showMainWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !isLanHostMode()) app.quit() })
app.on('before-quit', (event) => {
  if (quitting || !services) return
  event.preventDefault()
  quitting = true
  Promise.allSettled([services.sync.stop(), services.scanner.dispose(), services.lanHost.stop()]).finally(() => { destroyTray(); services.db.close(); app.quit() })
})
process.on('uncaughtException', (error) => { console.error(error); dialog.showErrorBox('Erro inesperado', error.message) })
process.on('unhandledRejection', (error) => console.error(error))