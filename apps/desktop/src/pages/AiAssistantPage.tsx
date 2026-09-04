import { FormEvent, useState } from 'react'
import { Bot, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { Button, Card, PageHeader } from '../components/ui'
import { buildAiAnalysisPayload } from '../utils/ai-context'
import './ai-assistant.css'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type AiMeta = { provider?: string; model?: string; basis?: string }

const suggestions = [
  'Quais são os principais riscos financeiros desta competência?',
  'O que está vencido e deve ser priorizado?',
  'Resuma a situação atual das obras e os pontos que merecem atenção.',
]

const currentCompetence = () => new Date().toISOString().slice(0, 7)

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try { return await promise } catch { return fallback }
}

export default function AiAssistantPage() {
  const [question, setQuestion] = useState('')
  const [competence, setCompetence] = useState(currentCompetence())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [meta, setMeta] = useState<AiMeta | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ask = async (event?: FormEvent) => {
    event?.preventDefault()
    const prompt = question.trim()
    if (!prompt || loading) return

    setError('')
    setLoading(true)
    setQuestion('')
    setMessages((current) => [...current, { role: 'user', content: prompt }])

    try {
      const onlineState = await window.fluxoDre.online.state()
      if (!onlineState?.linked) throw new Error('Vincule este Desktop ao Obra na Mão online em Configurações antes de usar a IA.')

      const [dashboard, works, accounts, people, tasks] = await Promise.all([
        safe(window.fluxoDre.relatorios.dashboard({ competence, competencia: competence }), {}),
        safe(window.fluxoDre.obras.list(), []),
        safe(window.fluxoDre.contas.list({ competencia: competence }), []),
        safe(window.fluxoDre.pessoas.list(), []),
        safe(window.fluxoDre.tarefas.list({}), []),
      ])

      const payload = buildAiAnalysisPayload({
        question: prompt,
        competence,
        dashboard,
        works,
        accounts,
        people,
        tasks,
      })

      const response = await window.fluxoDre.online.aiAnalyze({
        ...payload,
        history: messages.slice(-6),
      })
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

  const chooseSuggestion = (value: string) => {
    setQuestion(value)
    setError('')
  }

  return <div className="ai-assistant-page">
    <PageHeader
      title="Assistente IA"
      description="Gemini interpreta os dados já calculados pelo Obra na Mão. Os números do sistema continuam sendo a fonte de verdade."
    />

    <div className="ai-assistant-grid">
      <Card className="ai-safety-card">
        <div className="ai-safety-icon"><ShieldCheck size={21}/></div>
        <div>
          <strong>Arquitetura híbrida e somente leitura</strong>
          <p>O Desktop prepara um resumo determinístico e envia somente fatos compactos ao backend. A chave da Gemini não fica no aplicativo e a IA não altera lançamentos.</p>
        </div>
      </Card>

      <Card className="ai-chat-card">
        <div className="ai-chat-toolbar">
          <div className="ai-chat-title"><span><Bot size={19}/></span><div><strong>IA Obra na Mão</strong><small>{meta?.model ? `Gemini · ${meta.model}` : 'Análise estruturada do comercial'}</small></div></div>
          <label className="ai-competence"><span>Competência</span><input type="month" value={competence} onChange={(event) => setCompetence(event.target.value)}/></label>
        </div>

        <div className="ai-messages" aria-live="polite">
          {!messages.length && <div className="ai-welcome">
            <Sparkles size={24}/>
            <strong>Pergunte sobre financeiro, custos, obras, planejamento, RH ou medições.</strong>
            <p>A resposta é montada a partir dos indicadores locais disponíveis para a competência selecionada.</p>
            <div className="ai-suggestions">{suggestions.map((item) => <button key={item} type="button" onClick={() => chooseSuggestion(item)}>{item}</button>)}</div>
          </div>}

          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`ai-message ai-message-${message.role}`}>
            <span>{message.role === 'assistant' ? 'IA' : 'Você'}</span>
            <div>{message.content}</div>
          </div>)}

          {loading && <div className="ai-message ai-message-assistant ai-message-loading"><span>IA</span><div>Analisando os fatos calculados pelo sistema...</div></div>}
        </div>

        {error && <div className="ai-error" role="alert">{error}</div>}

        <form className="ai-composer" onSubmit={ask}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ex.: quais pagamentos vencidos devem ser priorizados e por quê?"
            rows={3}
            maxLength={4000}
            disabled={loading}
          />
          <div className="ai-composer-footer"><small>A Gemini recebe contexto resumido; não recebe o banco local inteiro.</small><Button type="submit" disabled={loading || !question.trim()} icon={<Send size={16}/>}>{loading ? 'Analisando...' : 'Perguntar'}</Button></div>
        </form>
      </Card>
    </div>
  </div>
}
