/// <reference types="vite/client" />
type EntityApi = { list(filters?: Record<string, unknown>): Promise<any[]>; get(id: number): Promise<any>; save(data: Record<string, unknown>): Promise<any>; remove(id: number, revision?: number): Promise<boolean> }
type RevisionConflictDetails = { resourceType:string|null; resourceId:string|null; expectedRevision:number; currentRevision:number; current:any }
type UpdaterState = { status:'idle'|'checking'|'current'|'available'|'downloading'|'downloaded'|'error'|'unsupported'; currentVersion:string; availableVersion:string|null; progress:number|null; error:string|null; supported:boolean }
type OperationalStorageMode = 'local'|'lan-host'|'lan-client'|'remote'
type ModuleStorageKey = 'core'|'operation'|'planning'|'finance'|'rh'
type ModuleStorageStateName = 'local'|'central-ready'|'central-active'|'migration-required'
type ModuleStorageState = { module:ModuleStorageKey; state:ModuleStorageStateName; localRecords:number; capabilityAvailable?:boolean; dependencyBlockedBy?:ModuleStorageKey; coreDependencyBlocked?:boolean }
type ModuleStorageStates = Record<ModuleStorageKey,ModuleStorageState>
type ModuleMigrationAttempt = { migrationId:string; module:ModuleStorageKey; sourceFingerprint:string; expectedCounts:Record<string,number>; status:string; lastError?:string|null; createdAt?:string; updatedAt?:string }
type ModuleMigrationStatus = { module:ModuleStorageKey; attempt:ModuleMigrationAttempt|null; storage:ModuleStorageState }
type ModuleMigrationPreflight = { module:ModuleStorageKey; state:ModuleStorageStateName; localCounts:Record<string,number>; capability:boolean; dependencies:{core:ModuleStorageStateName;blockedBy?:ModuleStorageKey|null}; canMigrate:boolean; reason?:string }
type ModuleMigrationResult = { migrationId:string; module:ModuleStorageKey; status:string; counts?:Record<string,number>; backup?:{database?:string;manifest?:string;fingerprint?:string;folder?:string} }
type StorageConnectionState = { mode:'local'|'server'; operationalMode:OperationalStorageMode; scheme:'http'|'https'; host:string; port:number; baseUrl:string; serverId:string|null; transport:'local-network'|'private-network'|'https' }
type StorageConnectionTest = { ok:true; baseUrl:string; latencyMs:number; serverId:string|null; health:{status:'ok';product:'Obra na Mão';apiVersion:'1'}; readiness?:{ready:boolean;status?:string;identity?:{serverId?:string|null}} }
type DiscoveredServer = { serverId:string; name:string; host:string; port:number; baseUrl:string; apiVersion:'1'; ready:true; latencyMs:number }
type LanMember = { memberId:string; email?:string; name?:string; role:string; modules?:string[]; channels?:string[]; status?:string }
type LanCredentialState = { paired:boolean; serverKey?:string; deviceId?:string|null; member?:LanMember|null; pairedAt?:string|null }
type LanHostState = { running:boolean; pid:number|null; startedAt:string|null; lastError:string|null; setupCode?:string|null }
type LanSetupStatus = { serverId?:string|null; claimed?:boolean; company?:{id:string;name?:string}|null; credential?:LanCredentialState; host?:LanHostState }
type LanAdminStatus = { company?:{id:string;name?:string}; revision?:string|null; lastCloudRefreshAt?:string|null; deviceCount?:number; stale?:boolean; paired?:LanCredentialState }
type LanReconnectState = { status:'connected'|'pairing-required'|'unreachable'|'not-applicable'; serverId:string|null; reason?:string; endpointChanged:boolean; reusedCredential:boolean; baseUrl?:string; device?:{id:string;status:string}|null; member?:LanMember|null }
type ServerBackup = { backupId:string; createdAt?:string; fingerprint?:string; schemaVersion?:number; serverId?:string|null; companyId?:string|null; serverVersion?:string|null; sizeBytes?:number; reason?:string; integrity?:string }
type ServerOperationsStatus = {
  server:{version:string;apiVersion:string;serverId:string|null;runtime:{mode:string|null;transport:string|null}}
  readiness:{ready:boolean;status:string}
  storage:{accessible?:boolean;integrity?:string;schemaVersion?:number;sizeBytes?:number;lastBackup?:ServerBackup|null;maintenance?:boolean}
  backup:{policy:{enabled:boolean;running:boolean;intervalHours:number;retentionCount:number;lastRun?:any;nextRunAt?:string|null};lastBackup?:ServerBackup|null}
  devices:{total:number;active:number;revoked:number}
  authority:{company:{id:string|null;name:string|null};revision:string|null;lastCloudRefreshAt:string|null;stale:boolean}
  sync:{authorityRevision:string|null;lastCloudRefreshAt:string|null;stale:boolean}
  capabilities:{version:number;modules:string[];bridgeEntities:string[];features:string[]}
}
type ExplorerEntry = { name:string; relativePath:string; kind:'folder'|'file'|'link'; extension:string; size:number|null; modifiedAt:string; canOpen:boolean }
type ExplorerDirectory = { rootId:string; name:string; relativePath:string; parentRelativePath:string|null; items:ExplorerEntry[] }
type ExplorerPreview = { rootId:string; name:string; relativePath:string; extension:string; size:number; modifiedAt:string; previewKind:'pdf'|'image'|'unsupported'; mimeType:string|null; dataUrl:string|null; previewBlockedReason:'size'|'type'|null }
type ExplorerMutationResult = { name:string; relativePath:string }
type ExplorerEmployee = { id:number; nome:string; cpf:string|null }
type ExplorerDocumentContext = { relativePath:string; employee:ExplorerEmployee|null; competencia:string|null; categoria:string|null; status:string; documentId:number|null; arquivoId:number|null }
type ExplorerDocumentIndex = { items:ExplorerDocumentContext[]; facets:{employees:ExplorerEmployee[];competencias:string[];categorias:string[];statuses:string[]} }
type ExplorerApi = {
  list(rootId:string,relativePath?:string):Promise<ExplorerDirectory>
  preview(rootId:string,relativePath:string):Promise<ExplorerPreview>
  open(rootId:string,relativePath?:string):Promise<string>
  createFolder(rootId:string,parentRelativePath:string,name:string):Promise<ExplorerMutationResult>
  rename(rootId:string,relativePath:string,newName:string):Promise<ExplorerMutationResult>
  move(rootId:string,relativePath:string,destinationRelativePath:string):Promise<ExplorerMutationResult>
  remove(rootId:string,relativePath:string,recursive?:boolean):Promise<boolean>
  pickImport(rootId:string,destinationRelativePath?:string):Promise<ExplorerMutationResult[]>
  importFiles(rootId:string,destinationRelativePath:string,sourcePaths:string[]):Promise<ExplorerMutationResult[]>
  pathForFile(file:File):string
  context(rootId:string,relativePath:string):Promise<ExplorerDocumentContext>
  index(rootId:string):Promise<ExplorerDocumentIndex>
  moveToSigned(rootId:string,relativePath:string):Promise<ExplorerDocumentContext>
}
type ScannerMode = 'grayscale'|'color'
type ScannerPage = { index:number; mode:ScannerMode; preview:string }
type ScannerSession = { sessionId:string; pages:ScannerPage[] }
type ScannerCapabilities = { platform:string; supported:boolean; available:boolean; backend:'wia'|null; dpi:number; modes:ScannerMode[] }
type ScannerSaveResult = { conflict:true; path:string; existingDocumentId:number|null } | { conflict:false; path:string; document:any }
type ScannerApi = {
  capabilities():Promise<ScannerCapabilities>
  start(data:{mode:ScannerMode}):Promise<ScannerSession>
  addPage(data:{sessionId:string;mode:ScannerMode}):Promise<ScannerSession>
  redoPage(data:{sessionId:string;pageIndex:number;mode:ScannerMode}):Promise<ScannerSession>
  discard(data:{sessionId:string}):Promise<boolean>
  saveSigned(data:{sessionId:string;documentId:number;replace:boolean}):Promise<ScannerSaveResult>
}
interface Window { fluxoDre: {
  app: { bootstrap(): Promise<any>; retryDatabase(): Promise<boolean>; getLayout(): Promise<'command-center'|'classic'>; setLayout(layout:'command-center'|'classic'): Promise<'command-center'|'classic'> }; product:{getEdition():Promise<{edition:'construtora'|'empreiteira';locked:boolean}>;setEdition(edition:'construtora'|'empreiteira'):Promise<any>}; demo:{seed():Promise<any>}
  storage:{state():Promise<StorageConnectionState>;configure(input:{mode?:'local'|'server';operationalMode?:OperationalStorageMode;scheme?:'http'|'https';host?:string;port?:number;address?:string}):Promise<StorageConnectionState>;testConnection():Promise<StorageConnectionTest>;discoverServers():Promise<DiscoveredServer[]>;probeAddress(address:string,operationalMode?:'lan-client'|'remote'):Promise<StorageConnectionTest>;connectAddress(address:string,operationalMode?:'lan-client'|'remote'):Promise<{state:StorageConnectionState;server:StorageConnectionTest}>;moduleState(module:ModuleStorageKey):Promise<ModuleStorageState>;refreshModuleCapabilities():Promise<ModuleStorageStates>;migrationPreflight(module:ModuleStorageKey):Promise<ModuleMigrationPreflight>;migrationStatus(module:ModuleStorageKey):Promise<ModuleMigrationStatus>;migrateModule(module:ModuleStorageKey):Promise<ModuleMigrationResult>;rollbackModuleMigration(module:ModuleStorageKey):Promise<{module:ModuleStorageKey;status:string}>}
  lan:{
    hostState():Promise<LanHostState>;startHost():Promise<LanHostState>;stopHost():Promise<LanHostState>;status():Promise<LanSetupStatus>;reconnect():Promise<LanReconnectState>;
    operationsStatus():Promise<ServerOperationsStatus>;listBackups():Promise<ServerBackup[]>;createBackup(reason?:string):Promise<ServerBackup>;testBackup(backupId:string):Promise<{restorable:boolean;backupId:string;integrity?:string}>;preUpgradeBackup():Promise<any>;restoreBackup(backupId:string):Promise<any>;
    claimHost(setupCode?:string):Promise<LanSetupStatus>;pair(code:string):Promise<LanCredentialState>;disconnect():Promise<LanCredentialState>;
    adminStatus():Promise<LanAdminStatus>;createPairing(memberId:string):Promise<{code:string;expiresAt:string;member?:LanMember}>;
    listDevices():Promise<Array<{id:string;memberId:string;installationId:string;deviceName:string;status:string;pairedAt?:string;lastSeenAt?:string}>>;
    setDeviceStatus(deviceId:string,status:'active'|'revoked'):Promise<any>;refreshIdentity():Promise<LanAdminStatus>;
    startAtLoginState():Promise<{enabled:boolean}>;setStartAtLogin(enabled:boolean):Promise<{enabled:boolean}>
  }
  conflicts:{onRevisionConflict(listener:(details:RevisionConflictDetails)=>void):()=>void}
  empresas: EntityApi; clientes: EntityApi; fornecedores: EntityApi; obras: EntityApi & { importSpreadsheets(): Promise<any>; overview(obra_id:number): Promise<any>; timeline(obra_id:number): Promise<any[]> }; etapas: EntityApi; locais: EntityApi; orcamentos: EntityApi; cronograma: EntityApi; rdos: EntityApi; rdoEquipe: EntityApi; rdoEquipamentos: EntityApi; rdoOcorrencias: EntityApi; rdoAnexos: EntityApi; arquivos: EntityApi
  medicoes: EntityApi & { saveWithItems(data:any):Promise<any>; anexos:EntityApi; itensMedidos:EntityApi; importAttachment(data:any):Promise<any>; mapa: EntityApi }; contas: EntityApi & { payment(id:number,payment:any):Promise<any> }
  categorias: EntityApi; cargos: EntityApi; funcionarios: EntityApi; folhas: EntityApi; lancamentosFolha: EntityApi; pagamentosFuncionario: EntityApi; beneficios: EntityApi; epis: EntityApi; funcionarioEpis: EntityApi; fontes: EntityApi; pastas: EntityApi
  documentos: EntityApi & { generate(data:any):Promise<any>; templates():Promise<any[]>; saveTemplate(data:any):Promise<any>; chooseLocalTemplate():Promise<any>; setDefaultTemplate(data:any):Promise<any>; importForEmployee(data:any):Promise<any>; importForWork(data:any):Promise<any>; open(path:string):Promise<any>; reveal(path:string):Promise<any>; copyPath(path:string):Promise<any>; openFolder():Promise<any>; chooseRoot():Promise<any>; getRoot():Promise<string>; delete(data:any):Promise<any> }
  explorador: ExplorerApi
  scanner: ScannerApi
  planejamento: { overview(obra_id:number):Promise<any> }; campo:{saveRdo(data:any):Promise<any>}; tarefas:EntityApi; compras: EntityApi & { cotacoes: EntityApi; pedidos: EntityApi; itens:EntityApi; recebimentos: EntityApi; estoque:EntityApi; summary(obra_id:number):Promise<any>; createOrder(data:any):Promise<any>;receiveMaterial(data:any):Promise<any>; moveStock(data:any):Promise<any> }; contratos: EntityApi & { aditivos:EntityApi; create(data:any):Promise<any>; addendum(data:any):Promise<any> }; frentes:EntityApi; subfrentes:EntityApi; checklistFrente:EntityApi
  folha: { employee(data:any):Promise<any>; saveVariable(data:any):Promise<any>; removeVariable(id:number):Promise<any>; confirm(data:any):Promise<any>; pending(competencia:string):Promise<any[]> }
  ponto: { get(data:any):Promise<any>; autoFill(data:any):Promise<any>; save(data:any):Promise<any>; generate(data:any):Promise<any>; generateAll(data:any):Promise<any[]> }
  catalogo: { list():Promise<any>; saveCargo(data:any):Promise<any>; saveCompensationPolicy(data:any):Promise<any>; saveBenefit(data:any):Promise<any>; saveLink(data:any):Promise<any>; deactivate(type:string,id:number):Promise<any> }
  importacoes: EntityApi & { preview():Promise<any>; commit(token:string):Promise<any> }; importadorUniversal:{choose():Promise<any>;preview(token:string,options:any):Promise<any>;commit(token:string,options:any):Promise<any>}; relatorios:{dashboard(filters?:any):Promise<any>;dre(filters?:any):Promise<any[]>};
  online:{
    passwordAuth(input:{email:string;password:string;code?:string;firstAccess:boolean}):Promise<{linked:boolean;needsSetup:boolean;company?:{id:string;name:string};project?:{id:string;name:string}}>;
    passwordSetup(input:{companyName:string;projectName:string}):Promise<{linked:boolean;needsSetup:boolean;company?:{id:string;name:string};project?:{id:string;name:string}}>;
    syncState():Promise<import('../../../packages/contracts/src/desktop-sync').DesktopSyncState>;
    onSyncStateChanged(listener:(state:import('../../../packages/contracts/src/desktop-sync').DesktopSyncState)=>void):()=>void;
    configureSync(scope:{companyId:number;workId:number}):Promise<import('../../../packages/contracts/src/desktop-sync').DesktopSyncState>;
    syncNow():Promise<import('../../../packages/contracts/src/desktop-sync').DesktopSyncState>;
    resolveLocalConflict(id:number,resolution:import('../../../packages/contracts/src/desktop-sync').LocalConflictResolution):Promise<import('../../../packages/contracts/src/desktop-sync').DesktopSyncState>;
    state():Promise<{baseUrl:string;installationId:string;linked:boolean;linkedAt:string|null;pending:{expiresAt:string|null}|null}>;
    setBaseUrl(baseUrl:string):Promise<any>;
    start(activationCode?:string):Promise<{approvalUrl:string;expiresAt:string}>;
    status():Promise<{status:'idle'|'pending'|'approved';linked:boolean;expiresAt?:string;deviceId?:string}>;
    session():Promise<any>;disconnect():Promise<any>;syncPull(sinceRevision?:number):Promise<any>;syncPush(changes:any[]):Promise<any>;
    publishMobileSummary(summary:any):Promise<any>;financeRead(view:string):Promise<any>;financeWrite(action:string,input:any):Promise<any>;
    publishFinanceReference(obligations:any[]):Promise<any>;aiAnalyze(input:any):Promise<any>;conflicts():Promise<any>;resolveConflict(conflictId:string,resolution:'accept_desktop'|'keep_mobile'):Promise<any>
  };
  updater:{state():Promise<UpdaterState>;check():Promise<UpdaterState>;download():Promise<UpdaterState>;install():Promise<boolean>;onStateChanged(listener:(state:UpdaterState)=>void):()=>void};
  backup:{create():Promise<any>;restore():Promise<any>;openDataFolder():Promise<any>}
} }