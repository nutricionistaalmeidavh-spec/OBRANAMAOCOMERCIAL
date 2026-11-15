import catalog from '../public/sistemas/products.json';

const COLLECTION = 'artisys_marketing_seo_overrides_v1';
const SITE = 'https://artisys.dev';

type Media = { src: string; alt?: string; caption?: string };
type Product = {
  slug: string; name: string; category?: string; pageMode: string; externalHref?: string;
  media?: { cover?: Media; hero?: Media; gallery?: Media[] };
};
type Changes = {
  title: string; description: string; ogTitle: string; ogDescription: string; image: string;
};
type Stored = Changes & { version: number; updatedAt: string };
type Db = { prepare(sql: string): {
  bind(...args: unknown[]): {
    first<T = { record_json: string }>(): Promise<T | null>;
    all<T = { id: string; record_json: string }>(): Promise<{ results?: T[] }>;
    run(): Promise<{ meta?: { changes?: number } }>;
  };
} };
type Env = {
  DB: Db;
  ASSETS: { fetch(request: Request): Promise<Response> };
};
type Authorize = () => Promise<Response>;
type MarketingPage = { slug: string; name: string; category: string; path: string; href: string; images: string[] };

function normalize(path: string) {
  try { return decodeURIComponent(path).replace(/\/index\.html$/i, '/').replace(/\/?$/, '/') }
  catch { return path; }
}
function getPath(product: Product) {
  if (product.pageMode === 'individual') return '/sistemas/' + product.slug + '/';
  if (product.pageMode === 'external' && product.externalHref?.startsWith('/'))
    return new URL(product.externalHref, SITE).pathname;
  return null;
}
function images(product?: Product): string[] {
  if (!product?.media) return [];
  const values = [product.media.cover?.src, product.media.hero?.src, ...(product.media.gallery || []).map(x => x.src)];
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && /^\/(?!\/)/.test(v)))];
}

export function marketingPages(): MarketingPage[] {
  const all = (catalog.products as Product[]);
  const pages: MarketingPage[] = [{
    slug: 'catalog', name: 'Vitrine de sistemas', category: 'Catálogo',
    path: '/sistemas/', href: SITE + '/sistemas/',
    images: images(all.find(x => x.slug === 'wppprospector'))
  }];
  for (const product of all) {
    const path = getPath(product);
    if (!path) continue; // Never attempt to edit third-party domains.
    pages.push({
      slug: product.slug, name: product.name, category: product.category || 'Sistema',
      path: normalize(path), href: new URL(path, SITE).href, images: images(product)
    });
  }
  return pages;
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer'
  } });
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char] || char));
}
function encodeText(value: string) {
  return String(value).replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g,'&amp;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function decodeText(value: string) {
  return value.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'");
}
function metaContent(head: string, key: string, attr: 'name'|'property' = 'name') {
  const tags = head.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!new RegExp('\\b'+attr+'\\s*=\\s*["\\\']'+key.replace(':','\\:')+'["\\\']','i').test(tag)) continue;
    const found = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (found) return decodeText(found[1] ?? found[2] ?? '');
  }
  return '';
}
function parseHead(html: string) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const title = decodeText(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '');
  const canonical = head.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] || '';
  return {
    title, description: metaContent(head,'description'), ogTitle: metaContent(head,'og:title','property'),
    ogDescription: metaContent(head,'og:description','property'),
    image: metaContent(head,'og:image','property').replace(SITE,''),
    canonical, robots: metaContent(head,'robots'),
    hasStructuredData: /application\/ld\+json/i.test(head)
  };
}
function getRecord(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const result = JSON.parse(raw) as Stored;
    return Number.isInteger(result.version) && result.version > 0 ? result : null;
  } catch { return null; }
}
async function stored(env: Env, slug: string): Promise<Stored | null> {
  const row = await env.DB.prepare(
    'SELECT record_json FROM kv_records WHERE collection=? AND id=?'
  ).bind(COLLECTION, slug).first<{record_json:string}>();
  return getRecord(row?.record_json || null);
}
async function readPage(request: Request, env: Env, page: MarketingPage) {
  const fetchUrl = new URL(page.href);
  fetchUrl.search = '';
  const asset = await env.ASSETS.fetch(new Request(fetchUrl, {method:'GET'}));
  if (!asset.ok) throw new Error('HTML da landing indisponível: ' + page.slug);
  const original = parseHead(await asset.text());
  const override = await stored(env, page.slug);
  const effective = override ? {
    title:override.title,description:override.description,ogTitle:override.ogTitle,
    ogDescription:override.ogDescription,image:override.image
  } : {
    title:original.title,description:original.description,
    ogTitle:original.ogTitle || original.title,
    ogDescription:original.ogDescription || original.description,
    image:original.image
  };
  return { ...page, canonical:original.canonical || page.href, robots:original.robots,
    hasStructuredData:original.hasStructuredData, original, effective,
    version:override?.version || 0, updatedAt:override?.updatedAt || null,
    customized:!!override };
}
function safeText(value: unknown, min: number, max: number) {
  return typeof value === 'string' && value.length >= min && value.length <= max &&
    !/[<>\u0000-\u001f\u007f]/.test(value) && value.trim()===value;
}
function validatePayload(body: unknown, page: MarketingPage): Changes | null {
  if (!body || typeof body!=='object' || Array.isArray(body)) return null;
  const data=body as Record<string,unknown>;
  const allowed = new Set(['expectedVersion','title','description','ogTitle','ogDescription','image']);
  if(Object.keys(data).some(key=>!allowed.has(key)))return null;
  if(!Number.isInteger(data.expectedVersion) || Number(data.expectedVersion)<0) return null;
  if(!safeText(data.title,10,90) || !safeText(data.description,45,220))return null;
  if(!safeText(data.ogTitle,0,100) || !safeText(data.ogDescription,0,240)) return null;
  if(typeof data.image!=='string' || (data.image!=='' && !page.images.includes(data.image))) return null;
  return {title:data.title as string,description:data.description as string,
    ogTitle:data.ogTitle as string,ogDescription:data.ogDescription as string,image:data.image};
}
function validOrigin(request: Request) {
  const origin=request.headers.get('origin');
  return (!origin || origin===new URL(request.url).origin) && request.headers.get('sec-fetch-site')!=='cross-site';
}

export function updateSeoHead(html: string, changes: Changes) {
  const match=/<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  if(!match) return html;
  let head=match[1];
  const keys=[['description','name'],['og:title','property'],['og:description','property'],
    ['og:image','property'],['twitter:title','name'],['twitter:description','name'],['twitter:image','name'],['twitter:card','name']] as const;
  head=head.replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi,'');
  head=head.replace(/<meta\b[^>]*>\s*/gi,tag=>{
    return keys.some(([key,attr])=>new RegExp('\\b'+attr+'\\s*=\\s*["\\\']'+key.replace(':','\\:')+'["\\\']','i').test(tag)) ? '' : tag;
  });
  const tags=[
    '<title>'+escapeHtml(changes.title)+'</title>',
    '<meta name="description" content="'+escapeHtml(changes.description)+'">',
    '<meta property="og:title" content="'+escapeHtml(changes.ogTitle || changes.title)+'">',
    '<meta property="og:description" content="'+escapeHtml(changes.ogDescription || changes.description)+'">',
    '<meta name="twitter:title" content="'+escapeHtml(changes.ogTitle || changes.title)+'">',
    '<meta name="twitter:description" content="'+escapeHtml(changes.ogDescription || changes.description)+'">',
    '<meta name="twitter:card" content="'+(changes.image?'summary_large_image':'summary')+'">'
  ];
  if(changes.image){
    const src = new URL(changes.image, SITE).href;
    tags.push('<meta property="og:image" content="'+escapeHtml(src)+'">');
    tags.push('<meta name="twitter:image" content="'+escapeHtml(src)+'">');

  }
  // Keep canonical, robots, structured data, assets, styles, and body untouched.
  const replacement='<head>'+head+'\n'+tags.join('\n')+'\n</head>';
  return html.slice(0,match.index)+replacement+html.slice(match.index+match[0].length);
}

export async function handleOwnerMarketingSeo(
  request: Request, env: Env, authorize: Authorize, now=new Date()
): Promise<Response | null> {
  const url=new URL(request.url);
  if(url.pathname!=='/api/owner/marketing-seo') return null;
  if(!['GET','PUT','DELETE'].includes(request.method)) return response({error:'Método não permitido.'},405);
  try {
    const auth=await authorize();
    if(!auth.ok || (await auth.json() as {role?:string}).role!=='owner')
      return response({error:'Acesso restrito ao proprietário.'},403);
  } catch { return response({error:'Não foi possível validar a sessão.'},403); }
  const pages=marketingPages();
  const slug=url.searchParams.get('slug');
  if(request.method==='GET' && !slug) {
    try {
      const rows=await env.DB.prepare('SELECT id,record_json FROM kv_records WHERE collection=?')
        .bind(COLLECTION).all<{id:string;record_json:string}>();
      const overrides=new Map((rows.results||[]).map(row=>[row.id,getRecord(row.record_json)]));
      return response({pages:pages.map(p=>({...p,customized:!!overrides.get(p.slug),
        updatedAt:overrides.get(p.slug)?.updatedAt || null}))});
    } catch {return response({error:'Não foi possível consultar páginas.'},503);}
  }
  const page=pages.find(x=>x.slug===slug);
  if(!page) return response({error:'Sistema não permitido.'},404);
  if(request.method==='GET') {
    try {return response({page:await readPage(request,env,page)});}
    catch {return response({error:'Não foi possível carregar os metadados.'},503);}
  }
  if(!validOrigin(request)) return response({error:'Origem não autorizada.'},403);
  if(request.method==='DELETE') {
    const version=Number(url.searchParams.get('version'));
    if(!Number.isInteger(version)||version<1)return response({error:'Versão inválida.'},400);
    try {
      const current=await stored(env,page.slug);
      if(current?.version!==version)return response({error:'Os metadados foram alterados por outra sessão. Atualize.'},409);
      const deleted=await env.DB.prepare(
        "DELETE FROM kv_records WHERE collection=? AND id=? AND CAST(json_extract(record_json,'$.version') AS INTEGER)=?"
      ).bind(COLLECTION,page.slug,version).run();
      if(deleted?.meta?.changes===0)return response({error:'Conflito de versão.'},409);
      return response({page:await readPage(request,env,page)});
    } catch {return response({error:'Não foi possível restaurar os metadados originais.'},503);}
  }
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))
    return response({error:'Tipo de conteúdo inválido.'},415);
  if(Number(request.headers.get('content-length')||0)>4096)return response({error:'Dados excedem o limite.'},413);
  let payload:unknown;
  try { const raw=await request.text(); if(raw.length>4096)return response({error:'Dados excedem o limite.'},413);payload=JSON.parse(raw); }
  catch {return response({error:'JSON inválido.'},400);}
  const changes=validatePayload(payload,page);
  if(!changes)return response({error:'Metadados inválidos. Verifique limites e imagem permitida.'},400);
  try {
    const expectedVersion=(payload as {expectedVersion:number}).expectedVersion;
    const prior=await stored(env,page.slug);
    if((prior?.version||0)!==expectedVersion)
      return response({error:'Os metadados foram atualizados por outra sessão. Recarregue.'},409);
    const next:Stored={...changes,version:expectedVersion+1,updatedAt:now.toISOString()};
    const stamp=now.toISOString();
    const write=await env.DB.prepare(
      'INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?) '+
      "ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at "+
      "WHERE CAST(json_extract(kv_records.record_json,'$.version') AS INTEGER)=?"
    ).bind(COLLECTION,page.slug,JSON.stringify(next),stamp,stamp,expectedVersion).run();
    if(write?.meta?.changes===0)return response({error:'Conflito de edição. Recarregue a página.'},409);
    return response({page:await readPage(request,env,page)});
  } catch {return response({error:'Não foi possível publicar os metadados.'},503);}
}

export async function handlePublicMarketingSeo(request: Request, env: Env): Promise<Response | null> {
  if(request.method!=='GET' && request.method!=='HEAD')return null;
  const url=new URL(request.url);
  const page=marketingPages().find(p=>normalize(p.path)===normalize(url.pathname));
  if(!page)return null;
  const asset=await env.ASSETS.fetch(request);
  if(!asset.ok || request.method==='HEAD')return asset;
  let current:Stored|null=null;
  try {current=await stored(env,page.slug);}catch{return asset;}
  if(!current)return asset;
  const type=asset.headers.get('content-type')||'';
  if(!/text\/html/i.test(type))return asset;
  const html=await asset.text();
  const updated=updateSeoHead(html,current);
  const headers=new Headers(asset.headers);
  headers.delete('content-length');headers.delete('etag');headers.delete('last-modified');
  headers.set('cache-control','private, no-store');
  headers.set('content-type','text/html; charset=utf-8');
  return new Response(updated,{status:asset.status,statusText:asset.statusText,headers});
}
