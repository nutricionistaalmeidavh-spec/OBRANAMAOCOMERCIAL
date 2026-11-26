const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, safeStorage } = require('electron')
const path = require('node:path')
const { createAccountProfiles } = require('./services/account-profiles.cjs')
const accounts = createAccountProfiles(app)
if (accounts.isolated && accounts.selected !== 'principal') { require('node:fs').mkdirSync(accounts.dataDir, { recursive: true }); app.setPath('userData', accounts.dataDir) }
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
const { PayrollImportFileService } = require('./services/payroll-import-file-service.cjs')
const { PayrollExportService } = require('./services/payroll-export-service.cjs')
const { DocumentService } = require('./services/document-service.cjs')
const { PayrollService } = require('./services/payroll-service.cjs')
const { exportEmployeeReport } = require('./services/employee-report.cjs')
const { EmployeeBatchService } = require('./services/employee-batch-service.cjs')
const { DocumentRootService } = require('./services/document-root-service.cjs')
const { CatalogService } = require('./services/catalog-service.cjs')
const { RhCatalogSourceService } = require('./services/rh-catalog-source-service.cjs')
const { RhSourceService } = require('./services/rh-source-service.cjs')
const { RhDocumentService } = require('./services/rh-document-service.cjs')
const { TimeService } = require('./services/time-service.cjs')
const { locationsPdfHtml, floorProgress } = require('./services/location-pdf.cjs')
const { ReceiptPolicyService } = require('./services/receipt-policy-service.cjs')
const { ScannerService } = require('./services/scanner-service.cjs')
const { WorkImportService } = require('./services/work-import-service.cjs')
const { UniversalImportService } = require('./services/universal-import-service.cjs')
const { OperationalSheetService } = require('./services/operational-sheet-service.cjs')
const { OperationalSheetP1Service } = require('./services/operational-sheet-p1-service.cjs')
const { WorksService } = require('./services/works-service.cjs')
const { PlanningService } = require('./services/planning-service.cjs')
const { PlanningSourceService } = require('./services/planning-source-service.cjs')
const { FinanceSourceService } = require('./services/finance-source-service.cjs')
const { BankFinanceSourceService } = require('./services/bank-finance-source.cjs')
const { MeasurementSourceService } = require('./services/measurement-source-service.cjs')
const { FieldService } = require('./services/field-service.cjs')
const { FieldSourceService } = require('./services/field-source-service.cjs')
const { ProcurementService } = require('./services/procurement-service.cjs')
const { ProcurementSourceService } = require('./services/procurement-source-service.cjs')
const { createReceivedNotesService } = require('./services/domain-core.cjs')
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
  const dataDir = accounts.dataDir
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
  const { BankFinanceService } = require(path.join(path.dirname(resolveLanServerEntry()), 'bank-finance.cjs'))
  const bankFinance = new BankFinanceSourceService({ local: new BankFinanceService({ db: db.db }), lanClient: dataAccess.remote, moduleStorage })
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
  const procurement = new ProcurementSourceService({ local: localProcurement, lanClient: dataAccess.remote, moduleStorage, notes: createReceivedNotesService(db.db) })
  const localContracts = new ContractsService({ db, product })
  const contracts = new ContractsSourceService({ local: localContracts, lanClient: dataAccess.remote, moduleStorage, dataAccess, product })
  const uiPreferences = new UiPreferencesService({ db })
  const online = new OnlineService({ dataDir: paths.dataDir, shell, safeStorage, expectedEmail: () => accounts.current()?.email, sharedInstallationIdPath: accounts.isolated ? path.join(app.getPath('appData'), 'obra-na-mao-comercial', 'installation-id') : null })
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
    payrollImportFiles: new PayrollImportFileService(),
    payrollExports: new PayrollExportService({ payroll: rh, dialog }),
    documents: new DocumentService({ db, fileService: files, dialog, dataAccess, moduleStorage }),
    payroll: rh,
    employeeBatch: new EmployeeBatchService({ dataAccess, dialog }),
    catalog,
    time, receiptPolicy: new ReceiptPolicyService({ dataAccess }),
    scanner: new ScannerService({ db, fileService: files, dataDir: paths.dataDir }),
    workImport: new WorkImportService({ db }),
    universalImport: new UniversalImportService({ db, moduleStorage }),
    operationalSheet: new OperationalSheetService({ db, moduleStorage, dialog }),
    operationalSheetP1: new OperationalSheetP1Service({db,moduleStorage,timeService:localTime}),
    works: new WorksService({ db, dataAccess, moduleStorage }), planning, field, finance, bankFinance, measurements,
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

async function assertRemoteStorageCapability({ allowExisting = false } = {}) {
  const session = await services.online.session()
  if (session?.access?.advancedServer===true || (allowExisting && session?.storageTopology?.mode==='remote' && session?.storageTopology?.serverId)) return session
  throw new Error('Servidor próprio exige o adicional comercial Advanced Server.')
}

async function configureStorage(payload) {
  const previous = services.storage.state()
  const requestedOperational = payload.operationalMode || (payload.mode === 'server' ? 'lan-client' : 'local')
  if (requestedOperational === 'remote' && (previous.operationalMode !== 'remote' || String(payload.host||previous.host)!==String(previous.host) || String(payload.port||previous.port)!==String(previous.port))) {
    await assertRemoteStorageCapability()
  }
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
  let expectedServerId = null
  if (operationalMode === 'remote') {
    const session = await assertRemoteStorageCapability({ allowExisting: true })
    if (session?.access?.advancedServer!==true) expectedServerId = String(session?.storageTopology?.serverId||'')||null
  }
  let rejectServerId = null
  if (previous.operationalMode === 'lan-host') {
    try {
      const currentServer = await services.lanSetup.status()
      rejectServerId = currentServer?.serverId || null
    } catch {}
  }
  const result = await services.storage.connectAddress(address, { rejectServerId, expectedServerId, operationalMode })
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
  ipcMain.handle('operational-sheet:commit', envelope((payload) => services.operationalSheet.commit(payload)))
  ipcMain.handle('operational-sheet:export', envelope((payload) => services.operationalSheet.exportFile(payload)))
  ipcMain.handle('operational-sheet:load-note-items', envelope(() => services.operationalSheet.loadNoteItems()))
  ipcMain.handle('operational-sheet:p1-commit', envelope(payload => services.operationalSheetP1.commit(payload)))
  ipcMain.handle('operational-sheet:p1-measurements', envelope(payload => services.operationalSheetP1.measurementOverview(payload)))
  ipcMain.handle('operational-sheet:p1-time-matrix', envelope(payload => services.operationalSheetP1.timeMatrix(payload)))
  ipcMain.handle('operational-sheet:p1-time-commit', envelope(payload => services.operationalSheetP1.commitTime(payload)))
  ipcMain.handle('locais:export-pdf', envelope(async ({ obra_id, heat }) => {
    const workId = Number(obra_id)
    const [work, rows, counts] = await Promise.all([services.dataAccess.get('obras', workId), services.dataAccess.list('locais_obra', { obra_id: workId }), services.dataAccess.locationCounts(workId)])
    if (!work) throw new Error('Obra não encontrada.')
    let progress = null
    if (heat) { try { progress = floorProgress(await services.sync.obra360('progressList', { workId })) } catch { progress = null } }
    const safe = String(work.nome || 'obra').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80)
    const target = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow() || undefined, { title: 'Salvar mapa de locais', defaultPath: path.join(app.getPath('documents'), `Locais da obra - ${safe}.pdf`), filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (target.canceled || !target.filePath) return null
    await services.time.printHtml(locationsPdfHtml({ work, rows, counts, progress }), target.filePath)
    shell.openPath(target.filePath)
    return { path: target.filePath }
  }))
  ipcMain.handle('locais:batch', envelope(({ obra_id, spec, dryRun }) => services.dataAccess.locationBatch(obra_id, spec, dryRun !== false)))
  ipcMain.handle('locais:counts', envelope(({ obra_id }) => services.dataAccess.locationCounts(obra_id)))
  ipcMain.handle('entity:list', envelope(({ table, filters }) => services.dataAccess.list(table, filters)))
  ipcMain.handle('entity:get', envelope(({ table, id }) => services.dataAccess.get(table, id)))
  ipcMain.handle('entity:save', envelope(({ table, data }) => services.dataAccess.save(table, data)))
  ipcMain.handle('entity:remove', envelope(({ table, id, revision }) => services.dataAccess.remove(table, id, revision)))
  ipcMain.handle('dashboard:get', envelope((filters) => services.finance.dashboard(filters)))
  ipcMain.handle('works:overview', envelope(({ obra_id }) => services.works.overview(obra_id)))
  ipcMain.handle('works:timeline', envelope(({ obra_id }) => services.works.timeline(obra_id)))
  ipcMain.handle('planning:overview', envelope(({ obra_id }) => services.planning.overview(obra_id)))
  ipcMain.handle('field:rdo-materials', envelope(async ({rdoId, update}) => {
    const states=['operation','finance'].map(domain=>services.moduleStorage.state(domain).state)
    const id=Number(rdoId)
    if(!Number.isSafeInteger(id)||id<1)throw new Error('Diário inválido.')
    if(states.every(state=>state==='central-active')){
      const api=services.dataAccess.remote
      if(update)return api.request('POST','/api/v1/field/rdo/materials',{body:{...update,rdoId:id}})
      const current=await api.request('GET','/api/v1/field/rdo/materials',{query:{rdo_id:id}})
      const catalog=await api.request('GET','/api/v1/field/rdo/catalog',{query:{obra_id:current.obraId,remote_company_id:services.online.readConfig().tenant?.companyId}})
      return {...current,materials:catalog.materials}
    }
    if(!states.every(state=>state==='local'))throw new Error('Operação e estoque precisam estar disponíveis na mesma base.')
    const dir=path.dirname(resolveLanServerEntry())
    const {pathToFileURL}=require('node:url')
    const {RdoMaterialConsumption}=await import(pathToFileURL(path.join(dir,'rdo-material-consumption.mjs')).href)
    const {FieldRdoCatalog}=await import(pathToFileURL(path.join(dir,'field-rdo-catalog.mjs')).href)
    const repository={get:(table,key)=>services.db.get(table,key),save:(table,value)=>services.db.save(table,value),connection:()=>services.db.db}
    const consumption=new RdoMaterialConsumption({repository})
    if(update)return consumption.save({...update,rdoId:id})
    const current=consumption.list(id),work=repository.get('obras',current.obraId)
    return {...current,materials:new FieldRdoCatalog({repository}).list({companyId:work.empresa_id,workId:work.id}).materials}
  }))
  ipcMain.handle('field:save-rdo', envelope((payload) => services.field.saveDailyReport(payload)))
  ipcMain.handle('received-notes:list', envelope(({ obra_id }) => services.procurement.listReceivedNotes(obra_id)))
  ipcMain.handle('received-notes:get', envelope(({ id }) => services.procurement.getReceivedNote(id)))
  ipcMain.handle('received-notes:summary', envelope(({ obra_id }) => services.procurement.receivedNotesSummary(obra_id)))
  ipcMain.handle('received-notes:report', envelope(filters => services.procurement.receivedCostsReport(filters)))
  ipcMain.handle('received-notes:create', envelope(payload => services.procurement.createReceivedNote(payload)))
  ipcMain.handle('received-notes:attach', envelope(({ id,documento_id }) => services.procurement.attachReceivedNote(id,documento_id)))
  ipcMain.handle('procurement:stock-export', envelope(async ({filters,format})=>{
    const result=await services.procurement.stockExport(filters)
    const history=filters?.history===true
    const fields=history?[['empresa_nome','Empresa'],['obra_nome','Obra'],['etapa_nome','Etapa'],['descricao','Material'],['unidade','Unidade'],['tipo','Tipo'],['quantidade','Quantidade'],['data','Data']]:[['empresa_nome','Empresa'],['obra_nome','Obra'],['etapa_nome','Etapa'],['descricao','Material'],['unidade','Unidade'],['entradas','Entradas'],['saidas','Saídas'],...(filters?.frente_id?[['liquido_etapa','Líquido da etapa']]:[]),['saldo','Saldo físico da obra'],['custo_medio_centavos','Custo médio estimado (R$)'],['saldo_estimado_centavos','Saldo valorizado estimado (R$)']]
    const rows=result.rows.map(row=>Object.fromEntries(fields.map(([key])=>[key,key.endsWith('_centavos')&&row[key]!=null?row[key]/100:row[key]??''])))
    return services.operationalSheet.exportFile({area:'estoque',format,filename:'estoque',columns:fields.map(([key,label])=>({key,label})),rows})
  }))
  const stockChanged=obra_id=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('procurement:stock-changed',{obra_id:obra_id||null})}
  const stockWrite=async(fn,obra_id)=>{const value=await fn();stockChanged(obra_id);return value}
  ipcMain.handle('procurement:reclassification-preview',envelope(payload=>services.procurement.reclassificationPreview(payload)))
  ipcMain.handle('procurement:reclassification-confirm',envelope(payload=>stockWrite(()=>services.procurement.reclassificationConfirm(payload,accounts.current()?.email||'operador-local'))))
  ipcMain.handle('procurement:stock-revision',envelope(filters=>services.procurement.stockRevision(filters)))
  ipcMain.handle('procurement:nfe-commit',envelope(payload=>stockWrite(()=>services.procurement.nfeCommit(payload))))
  ipcMain.handle('procurement:nfe-details',envelope(payload=>services.procurement.nfeDetails(payload)))
  ipcMain.handle('procurement:nfe-receive',envelope(payload=>stockWrite(()=>services.procurement.nfeReceive(payload))))
  ipcMain.handle('procurement:nfe-reverse',envelope(payload=>stockWrite(()=>services.procurement.nfeReverse(payload,accounts.current()?.email||'operador-local'))))
  ipcMain.handle('procurement:nfe-recognize',envelope(payload=>services.procurement.nfeRecognize(payload)))
  ipcMain.handle('procurement:catalog-page',envelope(filters=>services.procurement.catalogPage(filters)))
  ipcMain.handle('procurement:catalog-aliases',envelope(filters=>services.procurement.catalogAliases(filters)))
  ipcMain.handle('procurement:catalog-save',envelope(payload=>stockWrite(()=>services.procurement.catalogSave(payload))))
  ipcMain.handle('procurement:catalog-confirm',envelope(payload=>services.procurement.catalogConfirm(payload,accounts.current()?.email||'operador-local')))
  ipcMain.handle('procurement:stock-page', envelope(filters => services.procurement.stockPage(filters)))
  ipcMain.handle('procurement:summary', envelope(({ obra_id }) => services.procurement.summary(obra_id)))
  ipcMain.handle('procurement:create-order', envelope((payload) => services.procurement.createOrder(payload)))
  ipcMain.handle('procurement:receive-material', envelope(payload=>stockWrite(()=>services.procurement.receiveMaterial(payload))))
  ipcMain.handle('procurement:receive-many', envelope(payload=>stockWrite(()=>services.procurement.receiveMany(payload))))
  ipcMain.handle('procurement:move-stock', envelope(payload=>stockWrite(()=>services.procurement.moveStock(payload),payload.obra_id)))
  ipcMain.handle('contracts:create', envelope((payload) => services.contracts.createReceivable(payload)))
  ipcMain.handle('contracts:addendum', envelope((payload) => services.contracts.createAddendum(payload)))
  ipcMain.handle('dre:get', envelope((filters) => services.finance.dre(filters)))
  ipcMain.handle('accounts:payment', envelope(({ id, payment }) => services.finance.accountPayment(id, payment)))
  ipcMain.handle('bank:list', envelope(payload => services.bankFinance.listAccounts(payload)))
  ipcMain.handle('bank:manual-balances', envelope(payload => services.bankFinance.listManualBalances(payload)))
  ipcMain.handle('bank:record-balance', envelope(payload => services.bankFinance.recordManualBalance(payload)))
  ipcMain.handle('bank:save', envelope(payload => services.bankFinance.saveAccount(payload)))
  ipcMain.handle('bank:preview', envelope(payload => services.bankFinance.previewImport(payload)))
  ipcMain.handle('bank:confirm', envelope(payload => services.bankFinance.confirmImport(payload)))
  ipcMain.handle('bank:imports', envelope(payload => services.bankFinance.listImports(payload)))
  ipcMain.handle('bank:transactions', envelope(payload => services.bankFinance.listTransactions(payload)))
  ipcMain.handle('bank:suggestions', envelope(payload => services.bankFinance.suggestReconciliation(payload)))
  ipcMain.handle('bank:reconcile', envelope(payload => services.bankFinance.confirmReconciliation(payload)))
  ipcMain.handle('bank:reverse', envelope(payload => services.bankFinance.reverseReconciliation(payload)))
  ipcMain.handle('bank:reconciliations', envelope(payload => services.bankFinance.listReconciliations(payload)))
  ipcMain.handle('bank:cash-flow', envelope(payload => services.bankFinance.cashFlow(payload)))
  ipcMain.handle('bank:works', envelope(payload => services.bankFinance.listWorks(payload)))
  ipcMain.handle('bank:planned', envelope(payload => services.bankFinance.listPlannedAccounts(payload)))
  ipcMain.handle('bank:assign-plan', envelope(payload => services.bankFinance.assignPlannedBank(payload)))
  ipcMain.handle('bank:audit', envelope(payload => services.bankFinance.auditPeriod(payload)))
  ipcMain.handle('bank:period-status', envelope(payload => services.bankFinance.periodStatus(payload)))
  ipcMain.handle('bank:period-events', envelope(payload => services.bankFinance.periodEvents(payload)))
  ipcMain.handle('bank:period-close', envelope(payload => services.bankFinance.closePeriod(payload)))
  ipcMain.handle('bank:period-reopen', envelope(payload => services.bankFinance.reopenPeriod(payload)))
  ipcMain.handle('bank:simulate-cash', envelope(payload => services.bankFinance.simulateCashFlow(payload)))
  ipcMain.handle('bank:cash-report', envelope(payload => services.bankFinance.cashReport(payload)))
  ipcMain.handle('bank:forecast-capture', envelope(payload => services.bankFinance.captureForecast(payload)))
  ipcMain.handle('bank:forecasts', envelope(payload => services.bankFinance.listForecasts(payload)))
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
  ipcMain.handle('files:root-status', envelope(() => services.documentRoot.checkStatus()))
  ipcMain.handle('files:retry-root', envelope(() => services.documentRoot.retryRoot()))
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
  ipcMain.handle('documents:pending-files', envelope(() => services.files.pendingDocumentFiles()))
  ipcMain.handle('documents:recover-backup', envelope(() => services.files.recoverDocumentBackup()))
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
  ipcMain.handle('universal-import:dropped', envelope(({ filePath }) => services.universalImport.analyze(filePath)))
  ipcMain.handle('universal-import:template', envelope(({ area }) => services.universalImport.saveTemplate(area)))
  ipcMain.handle('universal-import:export-issues', envelope(({ token, options }) => services.universalImport.exportIssues(token, options)))
  ipcMain.handle('universal-import:save-mapping', envelope((options) => services.universalImport.saveMapping(options)))
  ipcMain.handle('universal-import:preview', envelope(({ token, options }) => services.universalImport.preview(token, options)))
  ipcMain.handle('universal-import:commit', envelope(async ({token,options})=>{const value=await services.universalImport.commit(token,options);if(options?.area==='estoque')stockChanged();return value}))
  ipcMain.handle('backup:create', envelope(() => services.backup.create()))
  ipcMain.handle('backup:restore', envelope(() => withSyncStopped(async () => {
    const result = await services.backup.restore()
    if (result?.restored) { services.db.db.prepare('DELETE FROM desktop_sync_scope WHERE id=1').run(); try { services.db.db.prepare('DELETE FROM desktop_sync_extra_scopes').run() } catch {} }
    return result
  })))
  ipcMain.handle('backup:open-data-folder', envelope(() => services.backup.openDataFolder()))
  ipcMain.handle('payroll-import:choose', envelope(() => services.payrollImportFiles.choose()))
  ipcMain.handle('payroll-import:file-preview', envelope(({ token, options }) => services.payrollImportFiles.preview(token, options)))
  ipcMain.handle('payroll-import:template', envelope(() => services.payrollImportFiles.saveTemplate()))
  ipcMain.handle('payroll-import:release', envelope(({ token }) => services.payrollImportFiles.release(token)))
  ipcMain.handle('payroll-import:preview', envelope((payload) => services.payroll.importPreview(payload)))
  ipcMain.handle('payroll-import:commit', envelope((payload) => services.payroll.importCommit(payload)))
  ipcMain.handle('payroll-import:history', envelope(({ limit }) => services.payroll.importHistory(limit)))
  ipcMain.handle('payroll-import:undo', envelope(({ id }) => services.payroll.importUndo(id)))
  ipcMain.handle('payroll:export-overview', envelope((payload) => services.payrollExports.export(payload)))
  ipcMain.handle('payroll:overview', envelope((payload) => services.payroll.overview(payload)))
  ipcMain.handle('employees:admission-template', envelope(() => services.employeeBatch.download(mainWindow)))
  ipcMain.handle('employees:admission-preview', envelope(({ companyId }) => services.employeeBatch.choose(mainWindow, companyId)))
  ipcMain.handle('employees:admission-commit', envelope(({ token }) => services.employeeBatch.commit(token)))
  ipcMain.handle('employees:export-report', envelope(payload => exportEmployeeReport({ dataAccess: services.dataAccess, dialog, window: mainWindow }, payload)))
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
  ipcMain.handle('time:receipt-policy', envelope(() => services.receiptPolicy.get()))
  ipcMain.handle('time:save-receipt-policy', envelope(payload => services.receiptPolicy.save(payload)))
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
  ipcMain.handle('accounts:list', envelope(() => ({ current: accounts.selected, accounts: accounts.list(), available: accounts.isolated })))
  ipcMain.handle('accounts:add', envelope(({ email }) => { if (!accounts.isolated) throw new Error('Abra o aplicativo pelo atalho normal para gerenciar as contas.'); return accounts.add(email) }))
  ipcMain.handle('accounts:switch', envelope(async ({ id }) => {
    if (!accounts.isolated) throw new Error('Troca de contas indisponível com pasta de dados personalizada.')
    if (!accounts.list().some(account => account.id === id)) throw new Error('Conta não cadastrada.')
    if (id === accounts.selected) return { switched: false }
    await services.sync.stop()
    app.relaunch({ args: [...process.argv.slice(1).filter(arg => !arg.startsWith('--obra-account=')), '--obra-account=' + id] })
    app.quit()
    return { switched: true }
  }))
  ipcMain.handle('online:password-auth', envelope((payload) => withSyncStopped(async () => { const expected = accounts.current()?.email; if (expected && String(payload.email || '').trim().toLowerCase() !== expected) throw new Error('Entre com o e-mail da conta selecionada.'); const result = await completeCanonicalStorage(await services.online.passwordAuth(payload)); accounts.bind(payload.email); return result })))
  ipcMain.handle('online:password-setup', envelope((payload) => withSyncStopped(async () => { const result = await completeCanonicalStorage(await services.online.completePasswordLink(payload)); return result })))
  ipcMain.handle('online:set-base-url', envelope(({ baseUrl }) => withSyncStopped(() => services.online.setBaseUrl(baseUrl))))
  ipcMain.handle('online:start', envelope((payload) => services.online.start(payload)))
  ipcMain.handle('online:status', envelope(() => withSyncStopped(async () => { const result = await completeCanonicalStorage(await services.online.status()); if (result.status === 'approved') { const session = await services.online.session(); accounts.bind(session.user?.email) } return result })))
  ipcMain.handle('online:complete-storage', envelope((payload) => withSyncStopped(() => completeCanonicalStorage({ linked: false }, payload))))
  ipcMain.handle('online:local-transfer-preview', envelope(() => services.canonicalStorage.prepareLocalTransfer()))
  ipcMain.handle('online:local-transfer', envelope((payload) => withSyncStopped(async () => {
    const result = await services.canonicalStorage.transferToLocal(payload)
    await configureStorage({ operationalMode: 'local' })
    services.online.clearRequiredStorage(result.serverId)
    return { linked: true, storageStatus: 'local', storageRequired: null }
  })))
  ipcMain.handle('online:session', envelope(() => services.online.session()))
  ipcMain.handle('online:set-storage-topology', envelope((payload) => services.online.setStorageTopology(payload)))
  ipcMain.handle('online:members-list', envelope(({ projectId }) => services.online.membersList(projectId)))
  ipcMain.handle('online:member-save', envelope((payload) => services.online.memberSave(payload)))
  ipcMain.handle('online:member-status', envelope(({ memberId, status, projectId }) => services.online.memberStatus(memberId, status, projectId)))
  ipcMain.handle('online:company-devices', envelope(() => services.online.companyDevices()))
  ipcMain.handle('online:revoke-company-device', envelope(({ deviceId }) => services.online.revokeCompanyDevice(deviceId)))
  ipcMain.handle('online:disconnect', envelope(() => withSyncStopped(() => services.online.disconnect())))
  ipcMain.handle('online:sync-state', envelope(() => services.sync.state()))
  ipcMain.handle('online:sync-configure', envelope((scope) => withSyncStopped(() => services.sync.configure(scope))))
  ipcMain.handle('online:sync-now', envelope(() => { requireSyncAvailable(); return services.sync.run({ retryNow: true }) }))
  const fieldInboxWorkIds = () => { const b = services.sync.binding(); return b ? [Number(b.scope.workId), ...services.sync.extraRows().map(row => Number(row.work_id))] : [] }
  const localObra360 = () => services.sync.runtimeState().source === 'local'
  ipcMain.handle('online:field-inbox-list', envelope(async () => { requireSyncAvailable(); return { items: await services.sync.obra360('pending', { workIds: fieldInboxWorkIds() }), issue: services.sync.inboxIssue || null } }))
  ipcMain.handle('online:field-inbox-dismiss', envelope(async ({ id }) => {
    requireSyncAvailable()
    if (!localObra360()) return services.sync.obra360('dismiss', { id, workIds: fieldInboxWorkIds() })
    const row = services.sync.fieldInbox().get(id); if (!row || !fieldInboxWorkIds().includes(Number(row.work_id))) throw new Error('Registro do celular não encontrado.'); services.sync.fieldInbox().mark(id, 'dismissed'); return { ok: true }
  }))
  ipcMain.handle('online:field-inbox-apply', envelope(async ({ id, funcionarioId, overwrite }) => {
    requireSyncAvailable()
    if (!localObra360()) return services.sync.obra360('applyItem', { id, funcionarioId, overwrite, workIds: fieldInboxWorkIds() })
    return services.sync.fieldInbox().applyItem({ id, funcionarioId, overwrite, workIds: fieldInboxWorkIds() }, services.time)
  }))
  ipcMain.handle('online:obra360-progress-list', envelope(({ workId }) => { requireSyncAvailable(); return services.sync.obra360('progressList', { workId }) }))
  ipcMain.handle('online:obra360-history', envelope((input) => { requireSyncAvailable(); return services.sync.obra360('historyList', input || {}) }))
  ipcMain.handle('online:obra360-progress-save', envelope(async (input) => { requireSyncAvailable(); const saved = await services.sync.obra360('progressSave', input || {}); services.sync.run({ retryNow: true }).catch(() => {}); return saved }))
  ipcMain.handle('online:sync-projects', envelope(() => { requireSyncAvailable(); return services.sync.listProjects() }))
  ipcMain.handle('online:sync-add-project', envelope(async ({ workId, remoteProjectId }) => { requireSyncAvailable(); const result = await services.sync.addProject({ workId, remoteProjectId }); services.sync.run({ retryNow: true }).catch(() => {}); return result }))
  ipcMain.handle('online:sync-link-field-rdo', envelope(({ date, workId }) => { requireSyncAvailable(); return services.sync.linkFieldRdo(String(date || ''), workId) }))
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
    if (!accounts.current()?.email && services.online.state().linked) {
      try { const session = await services.online.session(); accounts.bind(session.user?.email) }
      catch (error) { console.warn('Identidade da conta principal pendente de confirmação:', error?.message || error) }
    }
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
