/// <reference types="vite/client" />
type EntityApi = { list(filters?: Record<string, unknown>): Promise<any[]>; get(id: number): Promise<any>; save(data: Record<string, unknown>): Promise<any>; remove(id: number): Promise<boolean> }
type UpdaterState = { status:'idle'|'checking'|'current'|'available'|'downloading'|'downloaded'|'error'|'unsupported'; currentVersion:string; availableVersion:string|null; progress:number|null; error:string|null; supported:boolean }
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
  empresas: EntityApi; clientes: EntityApi; fornecedores: EntityApi; obras: EntityApi & { importSpreadsheets(): Promise<any>; overview(obra_id:number): Promise<any>; timeline(obra_id:number): Promise<any[]> }; etapas: EntityApi; locais: EntityApi; orcamentos: EntityApi; cronograma: EntityApi; rdos: EntityApi; rdoEquipe: EntityApi; rdoEquipamentos: EntityApi; rdoOcorrencias: EntityApi; rdoAnexos: EntityApi; arquivos: EntityApi
  medicoes: EntityApi & { saveWithItems(data:any):Promise<any>; anexos:EntityApi; itensMedidos:EntityApi; importAttachment(data:any):Promise<any>; mapa: EntityApi }; contas: EntityApi & { payment(id:number,payment:any):Promise<any> }
  categorias: EntityApi; cargos: EntityApi; funcionarios: EntityApi; folhas: EntityApi; lancamentosFolha: EntityApi; pagamentosFuncionario: EntityApi; beneficios: EntityApi; epis: EntityApi; funcionarioEpis: EntityApi; fontes: EntityApi; pastas: EntityApi
  documentos: EntityApi & { generate(data:any):Promise<any>; templates():Promise<any[]>; saveTemplate(data:any):Promise<any>; chooseLocalTemplate():Promise<any>; setDefaultTemplate(data:any):Promise<any>; importForEmployee(data:any):Promise<any>; importForWork(data:any):Promise<any>; open(path:string):Promise<any>; reveal(path:string):Promise<any>; copyPath(path:string):Promise<any>; openFolder():Promise<any>; chooseRoot():Promise<any>; getRoot():Promise<string>; delete(data:any):Promise<any> }
  explorador: ExplorerApi
  scanner: ScannerApi
  planejamento: { overview(obra_id:number):Promise<any> }; campo:{saveRdo(data:any):Promise<any>}; tarefas:EntityApi; compras: EntityApi & { cotacoes: EntityApi; pedidos: EntityApi; itens:EntityApi; recebimentos: EntityApi; estoque:EntityApi; summary(obra_id:number):Promise<any>; createOrder(data:any):Promise<any>;receiveMaterial(data:any):Promise<any>; moveStock(data:any):Promise<any> }; contratos: EntityApi & { aditivos:EntityApi; create(data:any):Promise<any>; addendum(data:any):Promise<any> }; frentes:EntityApi; subfrentes:EntityApi; checklistFrente:EntityApi
  folha: { employee(data:any):Promise<any>; saveVariable(data:any):Promise<any>; removeVariable(id:number):Promise<any>; confirm(data:any):Promise<any>; pending(competencia:string):Promise<any[]> }
  ponto: { get(data:any):Promise<any>; autoFill(data:any):Promise<any>; save(data:any):Promise<any>; generate(data:any):Promise<any>; generateAll(data:any):Promise<any[]> }
  catalogo: { list():Promise<any>; saveCargo(data:any):Promise<any>; saveBenefit(data:any):Promise<any>; saveLink(data:any):Promise<any>; deactivate(type:string,id:number):Promise<any> }
  importacoes: EntityApi & { preview():Promise<any>; commit(token:string):Promise<any> }; importadorUniversal:{choose():Promise<any>;preview(token:string,options:any):Promise<any>;commit(token:string,options:any):Promise<any>}; relatorios:{dashboard(filters?:any):Promise<any>;dre(filters?:any):Promise<any[]>};
  online:{
    syncState():Promise<import('../../../packages/contracts/src/desktop-sync').DesktopSyncState>;
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
