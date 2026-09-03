// Preserve existing bookmarked application routes, including desktop pairing tokens.
const sectionHashes = new Set(['', '#', '#topo', '#conteudo', '#servicos', '#prova', '#processo', '#contato']);

export function systemDestination(hash: string, search = ''): string | null {
  return sectionHashes.has(hash) ? null : `./sistema.html${search}${hash}`;
}
