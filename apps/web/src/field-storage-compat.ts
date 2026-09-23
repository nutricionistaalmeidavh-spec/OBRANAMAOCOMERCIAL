const LEGACY_FIELD_DB='fluxodre-campo-standalone';
const CANONICAL_FIELD_DB='obra-na-mao-comercial';

const factory=indexedDB as IDBFactory & {open:(name:string,version?:number)=>IDBOpenDBRequest};
const originalOpen=factory.open.bind(factory);

factory.open=((name:string,version?:number)=>{
  const target=name===LEGACY_FIELD_DB?CANONICAL_FIELD_DB:name;
  return version===undefined?originalOpen(target):originalOpen(target,version);
}) as IDBFactory['open'];

export { LEGACY_FIELD_DB, CANONICAL_FIELD_DB };
