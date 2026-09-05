import { useCallback, useEffect, useRef, useState } from 'react'

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const request = useRef(0)
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const load = useCallback(async () => {
    const current = ++request.current
    setLoading(true); setError(null)
    try { const result = await loader(); if (current === request.current) setData(result) } catch (e) { if (current === request.current) setError(e as Error) } finally { if (current === request.current) setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { void load(); return () => { request.current++ } }, [load])
  return { data, setData, loading, error, reload: load }
}
