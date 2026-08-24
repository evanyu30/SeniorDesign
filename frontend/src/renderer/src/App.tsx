import { useEffect, useRef, useState } from 'react'
import { Message } from '../../shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function App(): React.JSX.Element {
  type ThemeSource = 'system' | 'light' | 'dark'

  const [theme, setTheme] = useState<ThemeSource>('system')

  const handleThemeChange = async (next: ThemeSource): Promise<void> => {
    setTheme(next)
    await window.api.setTheme(next)
  }

  const [messages, setMessages] = useState<Message[]>([
    //{ role: 'assistant', content: 'Hello, how can I help you?' }
  ])

  const [input, setInput] = useState('')

  const [loading, setLoading] = useState(false)

  type ProviderInfo = { id: string; models: string[] }

  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [providerId, setProviderId] = useState('')
  const [model, setModel] = useState('')

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || loading || !providerId || !model) return

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages([...next, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)

    try {
      await window.api.sendChat(next, providerId, model)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: `Error: ${msg}` }])
      setLoading(false)
    }
  }

  useEffect(() => {
    const offChunk = window.api.onChunk((delta) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, content: last.content + delta }]
      })
    })

    const offDone = window.api.onDone(() => setLoading(false))

    return () => {
      offChunk()
      offDone()
    }
  }, [])

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleProviderChange = (id: string): void => {
    setProviderId(id)
    const next = providers.find((p) => p.id === id)
    setModel(next?.models[0] ?? '')
  }

  const currentModels = providers.find((p) => p.id === providerId)?.models ?? []

  useEffect(() => {
    window.api.listProviders().then((list) => {
      setProviders(list)
      if (list.length > 0) {
        setProviderId(list[0].id)
        setModel(list[0].models[0])
      }
    })
  }, [])

  return (
    <>
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === 'assistant' ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            ) : (
              m.content
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="toolbar">
        <select
          value={providerId}
          onChange={(e) => handleProviderChange(e.target.value)}
          disabled={loading}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>

        <select value={model} onChange={(e) => setModel(e.target.value)} disabled={loading}>
          {currentModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select value={theme} onChange={(e) => handleThemeChange(e.target.value as ThemeSource)}>
          <option value="system">auto</option>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      </div>
      <div className="composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask anything..."
        />
        <button onClick={loading ? () => window.api.abortChat() : handleSend}>
          {loading ? 'Stop' : 'Send'}
        </button>
      </div>
    </>
  )
}

export default App
