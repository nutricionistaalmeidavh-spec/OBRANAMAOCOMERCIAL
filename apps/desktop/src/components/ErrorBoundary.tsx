import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui'

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return <main className="fatal"><div className="fatal-card"><AlertTriangle/><h1>Algo saiu do esperado</h1><p>Seus dados continuam salvos. Recarregue a interface para tentar novamente.</p><pre className="error-inline">{this.state.error.message}</pre><details open><summary>Detalhes tecnicos</summary>{this.state.error.stack}</details><Button onClick={() => location.reload()}>Recarregar aplicativo</Button></div></main>
  }
}
