/** Durable, identity-scoped drafts. Whole-project snapshots stop on overlapping remote divergence. */
export type Draft = { base: unknown; state: unknown; savedAt: string };
export function syncScope(b: any): string | null {
  const ids = [b?.user?.userId || b?.membership?.email, b?.membership?.companyId || b?.company?.id, b?.membership?.projectId || b?.project?.id];
  return ids.every(Boolean) ? `artisys:field-draft:${ids.map(encodeURIComponent).join(':')}` : null;
}
export function createFieldSync(options: { key: string; storage: Storage; baseline: unknown; readRemote: () => Promise<unknown>; send: (state: any) => Promise<unknown>; status: (value: 'saving' | 'pending' | 'conflict' | 'idle') => void }) {
  let base = options.baseline, running: Promise<void> | null = null, disposed = false;
  const read = (): Draft | null => {
    const raw = options.storage.getItem(options.key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object' || !('base' in draft) || !('state' in draft)) throw new Error('Rascunho local inválido; preservado para recuperação.');
    return draft;
  };
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const plainObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  type MergeResult = { ok: true; value: unknown } | { ok: false };
  const mergeThreeWay = (baseline: unknown, remote: unknown, draft: unknown): MergeResult => {
    if (same(draft, baseline)) return { ok: true, value: remote };
    if (same(remote, baseline) || same(remote, draft)) return { ok: true, value: draft };
    if (!plainObject(baseline) || !plainObject(remote) || !plainObject(draft)) return { ok: false };
    const merged: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(baseline), ...Object.keys(remote), ...Object.keys(draft)]);
    for (const key of keys) {
      const next = mergeThreeWay(baseline[key], remote[key], draft[key]);
      if (!next.ok) return { ok: false };
      if (next.value !== undefined) merged[key] = next.value;
    }
    return { ok: true, value: merged };
  };
  const save = (state: unknown) => {
    if (disposed) throw new Error('Sessão encerrada. Entre novamente antes de salvar.');
    const existing = read();
    options.storage.setItem(options.key, JSON.stringify({ base: existing?.base ?? base, state, savedAt: new Date().toISOString() }));
    options.status('pending');
  };
  const flush = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (running) return running;
    running = (async () => {
      while (!disposed) {
        const draft = read(); if (!draft) return;
        options.status('saving');
        try {
          const remote = await options.readRemote();
          if (disposed) return;
          const merged = mergeThreeWay(draft.base, remote, draft.state);
          if (!merged.ok) { options.status('conflict'); return; }
          if (!same(remote, merged.value)) await options.send(merged.value);
          if (disposed) return;
          base = same(remote, merged.value) ? remote : await options.readRemote();
          if (disposed) return;
          const latest = read();
          if (latest && !same(latest, draft)) {
            const rebased = mergeThreeWay(draft.state, base, latest.state);
            options.storage.setItem(options.key, JSON.stringify(rebased.ok ? { ...latest, base, state: rebased.value } : latest));
            continue;
          }
          options.storage.removeItem(options.key); options.status('idle'); return;
        } catch { options.status('pending'); return; }
      }
    })().finally(() => { running = null; });
    return running;
  };
  return { read, save, flush, dispose: () => { disposed = true; } };
}