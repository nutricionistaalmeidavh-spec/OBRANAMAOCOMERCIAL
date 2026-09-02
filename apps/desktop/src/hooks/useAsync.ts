import { useCallback, useEffect, useState } from 'react'

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await loader()) } catch (e) { setError(e as Error) } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { void load() }, [load])
  return { data, setData, loading, error, reload: load }
}
