import { createContext, ReactNode, useContext, useState } from 'react'
import { currentCompetence } from '../utils/format'

type WorkContext = { competencia: string; empresaId: string; obraId: string }
const key = 'artisys.commercial.work-context.v1'
export function normalizeWorkContext(value: Partial<WorkContext> | null): WorkContext {
  return { competencia: /^\d{4}-(0[1-9]|1[0-2])$/.test(value?.competencia || '') ? value!.competencia! : currentCompetence(), empresaId: /^\d+$/.test(value?.empresaId || '') ? value!.empresaId! : '', obraId: /^\d+$/.test(value?.obraId || '') ? value!.obraId! : '' }
}
const Context = createContext<{ context: WorkContext; update: (patch: Partial<WorkContext>) => void } | null>(null)
export function WorkContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<WorkContext>(() => { try { return normalizeWorkContext(JSON.parse(localStorage.getItem(key) || 'null')) } catch { return normalizeWorkContext(null) } })
  const update = (patch: Partial<WorkContext>) => setContext(previous => {
    const next = normalizeWorkContext({ ...previous, ...(patch.empresaId !== undefined && patch.empresaId !== previous.empresaId ? {obraId:''} : {}), ...patch })
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Selection remains available for this session. */ }
    return next
  })
  return <Context.Provider value={{ context, update }}>{children}</Context.Provider>
}
export function useWorkContext() {
  const value = useContext(Context)
  if (!value) throw new Error('WorkContextProvider ausente')
  return { ...value.context, update: value.update, setCompetencia: (competencia: string) => value.update({competencia}) }
}
