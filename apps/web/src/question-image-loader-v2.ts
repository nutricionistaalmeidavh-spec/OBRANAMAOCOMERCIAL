import { hasQuestionVisual } from './question-visual-index';

const ZIP_URL = './resources/question-assets-549.zip';
const MANIFEST_URL = './resources/question-visuals-manifest.json';
const RANGE_TAIL_SIZE = 128 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

type ZipEntry = { method: number; compressedSize: number; offset: number; name: string };
type Visual = { file: string; alt: string };
type ZipState = { entries: Map<string, ZipEntry>; visuals: Map<string, Visual>; buffer?: ArrayBuffer };

const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
const fuzzyWords = (value: string) => normalize(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
const decoder = new TextDecoder();
let statePromise: Promise<ZipState> | null = null;
const urlCache = new Map<string, string>();

async function fetchWithTimeout(url = ZIP_URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'force-cache' });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readManifest(state: ZipState, manifestEntry?: ZipEntry) {
  if (manifestEntry) return decoder.decode(await readEntry(state, manifestEntry));
  // The deployed image ZIP intentionally contains only image binaries. The
  // small JSON manifest is a separate cacheable resource so browsers do not
  // download or parse the whole archive just to discover a mapping.
  const response = await fetchWithTimeout(MANIFEST_URL);
  if (!response.ok) throw new Error('Manifesto visual ausente');
  return response.text();
}

function registerEntry(entries: Map<string, ZipEntry>, entry: ZipEntry) {
  entries.set(entry.name, entry);
  const basename = entry.name.split('/').pop();
  if (basename && !entries.has(basename)) entries.set(basename, entry);
}

function readEntriesFromCentral(buffer: ArrayBuffer, total: number) {
  const view = new DataView(buffer);
  const entries = new Map<string, ZipEntry>();
  let p = 0;
  for (let i = 0; i < total; i += 1) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Índice ZIP inválido');
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, p + 46, nameLen));
    registerEntry(entries, { method, compressedSize, offset, name });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function findEndOfCentralDirectory(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const min = Math.max(0, buffer.byteLength - 65_557);
  for (let i = buffer.byteLength - 22; i >= min; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      return {
        total: view.getUint16(i + 10, true),
        centralSize: view.getUint32(i + 12, true),
        centralOffset: view.getUint32(i + 16, true),
      };
    }
  }
  throw new Error('ZIP inválido');
}

function entriesFromFullBuffer(buffer: ArrayBuffer) {
  const end = findEndOfCentralDirectory(buffer);
  return readEntriesFromCentral(buffer.slice(end.centralOffset, end.centralOffset + end.centralSize), end.total);
}

async function decodeEntry(entry: ZipEntry, compressed: Uint8Array): Promise<Uint8Array> {
  if (entry.method === 0) return compressed.slice();
  if (entry.method !== 8) throw new Error('Compressão ZIP não suportada');
  return new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}

async function readEntry(state: ZipState, entry: ZipEntry): Promise<Uint8Array> {
  if (state.buffer) {
    const view = new DataView(state.buffer);
    const nameLen = view.getUint16(entry.offset + 26, true);
    const extraLen = view.getUint16(entry.offset + 28, true);
    const start = entry.offset + 30 + nameLen + extraLen;
    return decodeEntry(entry, new Uint8Array(state.buffer, start, entry.compressedSize));
  }
  const headerResponse = await fetchWithTimeout({ headers: { Range: `bytes=${entry.offset}-${entry.offset + 29}` } });
  if (!headerResponse.ok) throw new Error('Falha ao carregar imagem de apoio');
  const header = new Uint8Array(await headerResponse.arrayBuffer());
  if (header.length < 30 || new DataView(header.buffer).getUint32(0, true) !== 0x04034b50) throw new Error('Cabeçalho ZIP inválido');
  const headerView = new DataView(header.buffer);
  const nameLen = headerView.getUint16(26, true);
  const extraLen = headerView.getUint16(28, true);
  const start = entry.offset + 30 + nameLen + extraLen;
  const bodyResponse = await fetchWithTimeout({ headers: { Range: `bytes=${start}-${start + entry.compressedSize - 1}` } });
  if (!bodyResponse.ok) throw new Error('Falha ao carregar imagem de apoio');
  return decodeEntry(entry, new Uint8Array(await bodyResponse.arrayBuffer()));
}

async function loadState(): Promise<ZipState> {
  if (statePromise) return statePromise;
  statePromise = (async () => {
    const tailResponse = await fetchWithTimeout({ headers: { Range: `bytes=-${RANGE_TAIL_SIZE}` } });
    if (!tailResponse.ok) throw new Error('Falha ao carregar apoios visuais');
    const tail = await tailResponse.arrayBuffer();
    if (tailResponse.status === 206) {
      const end = findEndOfCentralDirectory(tail);
      const contentRange = tailResponse.headers.get('content-range');
      const match = contentRange?.match(/bytes\s+(\d+)-/i);
      const tailStart = match ? Number(match[1]) : 0;
      const centralEnd = end.centralOffset + end.centralSize - 1;
      let central: ArrayBuffer;
      if (end.centralOffset >= tailStart && centralEnd < tailStart + tail.byteLength) {
        central = tail.slice(end.centralOffset - tailStart, end.centralOffset - tailStart + end.centralSize);
      } else {
        const response = await fetchWithTimeout({ headers: { Range: `bytes=${end.centralOffset}-${centralEnd}` } });
        if (!response.ok) throw new Error('Falha ao carregar índice visual');
        central = await response.arrayBuffer();
      }
      const state: ZipState = { entries: readEntriesFromCentral(central, end.total), visuals: new Map() };
      const manifestEntry = state.entries.get('question-visuals-manifest.json');
      const manifest = JSON.parse(await readManifest(state, manifestEntry)) as Array<{ prompt: string; src: string; alt: string }>;
      manifest.forEach((item) => state.visuals.set(normalize(item.prompt), { file: item.src.split('/').pop() || '', alt: item.alt || 'Apoio visual complementar' }));
      return state;
    }
    // Static hosts that ignore Range return the complete ZIP in this response.
    const buffer = tail.byteLength > RANGE_TAIL_SIZE ? tail : await (await fetchWithTimeout()).arrayBuffer();
    const state: ZipState = { buffer, entries: entriesFromFullBuffer(buffer), visuals: new Map() };
    const manifestEntry = state.entries.get('question-visuals-manifest.json');
    const manifest = JSON.parse(await readManifest(state, manifestEntry)) as Array<{ prompt: string; src: string; alt: string }>;
    manifest.forEach((item) => state.visuals.set(normalize(item.prompt), { file: item.src.split('/').pop() || '', alt: item.alt || 'Apoio visual complementar' }));
    return state;
  })().catch((error) => {
    statePromise = null;
    throw error;
  });
  return statePromise;
}

function visualForPrompt(state: ZipState, prompt: string): Visual | undefined {
  const exact = state.visuals.get(normalize(prompt));
  if (exact) return exact;
  // Some legacy manifests contain replacement characters where accents were
  // decoded incorrectly (e.g. 'haver�' vs. 'haverá'). Match only when nearly
  // every word agrees, accepting a prefix for the damaged word.
  const target = fuzzyWords(prompt);
  let best: Visual | undefined;
  let bestScore = 0;
  state.visuals.forEach((visual, manifestPrompt) => {
    const words = fuzzyWords(manifestPrompt);
    if (Math.abs(words.length - target.length) > 1) return;
    const matched = target.filter((word) => words.some((candidate) => candidate === word || (word.length >= 4 && candidate.length >= 4 && (word.startsWith(candidate) || candidate.startsWith(word))))).length;
    const score = matched / Math.max(target.length, words.length);
    if (score > bestScore) { bestScore = score; best = visual; }
  });
  return bestScore >= 0.9 ? best : undefined;
}

function setUnavailable(node: HTMLElement, retry: () => void) {
  node.innerHTML = '<button type="button" class="edu-question-visual-unavailable">Imagem indisponível. Tentar novamente</button>';
  node.querySelector('button')?.addEventListener('click', retry, { once: true });
}

export async function hydrateQuestionVisuals(root: ParentNode = document) {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-question-visual]'));
  if (!nodes.length) return;
  nodes.forEach((node) => { if (!hasQuestionVisual(node.dataset.questionPrompt || '')) node.remove(); });
  const mapped = nodes.filter((node) => node.isConnected);
  if (!mapped.length) return;
  try {
    const state = await loadState();
    await Promise.all(mapped.map(async (node) => {
      const retry = () => { statePromise = null; void hydrateQuestionVisuals(node.parentElement || document); };
      try {
        const visual = visualForPrompt(state, node.dataset.questionPrompt || '');
        if (!visual) return setUnavailable(node, retry);
        let url = urlCache.get(visual.file);
        if (!url) {
          const entry = state.entries.get(visual.file);
          if (!entry) throw new Error('Imagem não encontrada no pacote');
          url = URL.createObjectURL(new Blob([await readEntry(state, entry)], { type: 'image/webp' }));
          urlCache.set(visual.file, url);
        }
        const img = document.createElement('img');
        img.src = url;
        img.alt = visual.alt;
        img.loading = 'eager';
        node.replaceChildren(img);
      } catch (error) {
        console.warn('Falha ao carregar imagem de apoio', error);
        setUnavailable(node, retry);
      }
    }));
  } catch (error) {
    console.warn('Falha ao preparar apoios visuais', error);
    mapped.forEach((node) => setUnavailable(node, () => { statePromise = null; void hydrateQuestionVisuals(root); }));
  }
}

