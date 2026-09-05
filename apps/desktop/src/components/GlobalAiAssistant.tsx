import { FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bot, ExternalLink, Send, Sparkles, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useWorkContext } from '../hooks/useWorkContext'
import { buildAiAnalysisPayload } from '../utils/ai-context'
import './global-ai-assistant.css'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type AiMeta = { provider?: string; model?: string; basis?: string }

type Props = {
  screenLabel: string
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try { return await promise } catch { return fallback }
}

export function GlobalAiAssistant({ screenLabel }: Props) {
  const location = useLocation()
  const { competencia, empresaId, obraId } = useWorkContext()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [meta, setMeta] = useState<AiMeta | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const ask = async (event?: FormEvent) => {
    event?.preventDefault()
    const prompt = question.trim()
    if (!prompt || loading) return

    setError('')
    setLoading(true)
    setQuestion('')
    const history = messages.slice(-6)
    setMessages((current) => [...current, { role: 'user', content: prompt }])

    try {
      const onlineState = await window.fluxoDre.online.state()
      if (!onlineState?.linked) throw new Error('Vincule este Desktop ao Obra na Mão online em Configurações antes de usar a IA.')

      const [dashboard, works, accounts, people, tasks] = await Promise.all([
        safe(window.fluxoDre.relatorios.dashboard({ competencia, empresa_id: empresaId || undefined, obra_id: obraId || undefined }), {}),
        safe(window.fluxoDre.obras.list(), []),
        safe(window.fluxoDre.contas.list({ competencia, empresa_id: empresaId || undefined, obra_id: obraId || undefined }), []),
        safe(window.fluxoDre.funcionarios.list(), []),
        safe(window.fluxoDre.tarefas.list(obraId ? { obra_id: obraId } : {}), []),
      ])

      const payload = buildAiAnalysisPayload({
        question: prompt,
        competence: competencia,
        dashboard,
        works,
        accounts,
        people,
        tasks,
        screen: screenLabel,
        pathname: location.pathname,
        empresaId,
        obraId,
      })

      const response = await window.fluxoDre.online.aiAnalyze({ ...payload, history })
      const answer = String(response?.answer || response?.text || '').trim()
      if (!answer) throw new Error('A Gemini não retornou uma resposta utilizável.')

      setMeta({ provider: response?.provider, model: response?.model, basis: response?.basis })
      setMessages((current) => [...current, { role: 'assistant', content: answer }])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar a IA neste momento.')
    } finally {
      setLoading(false)
    }
  }

  const drawer = open ? createPortal(
    <aside id="global-ai-drawer" className="global-ai-drawer" aria-label="Assistente IA global">
      <div className="global-ai-head">
        <div className="global-ai-title"><span><Bot size={18}/></span><div><strong>ArtiSys IA</strong><small>{meta?.model ? `Gemini · ${meta.model}` : screenLabel}</small></div></div>
        <button type="button" className="global-ai-close" aria-label="Fechar assistente" onClick={() => setOpen(false)}><X size={18}/></button>
      </div>

      <div className="global-ai-context">
        <Sparkles size={14}/><span>Contexto: <strong>{screenLabel}</strong></span>
      </div>

      <div className="global-ai-messages" aria-live="polite">
        {!messages.length && <div className="global-ai-welcome">
          <strong>Pergunte sobre esta tela ou sobre os dados da empresa.</strong>
          <p>A IA recebe um resumo dos dados locais e o contexto da página atual. Ela não altera lançamentos.</p>
        </div>}
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`global-ai-message global-ai-message-${message.role}`}>
          <span>{message.role === 'assistant' ? 'IA' : 'Você'}</span>
          <div>{message.content}</div>
        </div>)}
        {loading && <div className="global-ai-message global-ai-message-assistant"><span>IA</span><div>Analisando os dados disponíveis...</div></div>}
      </div>

      {error && <div className="global-ai-error" role="alert">{error}</div>}

      <form className="global-ai-composer" onSubmit={ask}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={`Pergunte sobre ${screenLabel.toLowerCase()}...`}
          rows={3}
          maxLength={4000}
          disabled={loading}
        />
        <div className="global-ai-actions">
          <Link to='/assistente-ia' onClick={() => setOpen(false)}>Abrir assistente completo <ExternalLink size={13}/></Link>
          <button type="submit" disabled={loading || !question.trim()}><Send size={14}/>{loading ? 'Analisando...' : 'Perguntar'}</button>
        </div>
      </form>
    </aside>,
    document.body,
  ) : null

  return <div className="global-ai-root">
    <button
      type="button"
      className={`global-ai-trigger ${open ? 'is-open' : ''}`}
      aria-expanded={open}
      aria-controls="global-ai-drawer"
      onClick={() => setOpen((value) => !value)}
    >
      <Sparkles size={16}/><span>IA</span>
    </button>
    {drawer}
  </div>
}
