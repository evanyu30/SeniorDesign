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

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || loading) return

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages([...next, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)

    try {
      // Resolves once the whole SSE stream has ended -- the actual text
      // arrives incrementally through the rag:* listeners below.
      await window.api.sendRagChat(text)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `**Backend unreachable**\n\n${msg}` }
      ])
      setLoading(false)
    }
  }

  useEffect(() => {
    // sources arrives first: show what was retrieved before any answer text exists.
    const offSources = window.api.onRagSources(({ results }) => {
      if (results.length === 0) return
      const list = results
        .map((r, i) => `${i + 1}. **${r.title ?? r.paper_id}**${r.score != null ? ` (score ${r.score.toFixed(2)})` : ''}`)
        .join('\n')
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, content: `**Sources**\n${list}\n\n---\n\n` }]
      })
    })

    const offToken = window.api.onRagToken((text) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, content: last.content + text }]
      })
    })

    const offError = window.api.onRagError((detail) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, content: last.content + `\n\n**Error:** ${detail}` }]
      })
    })

    const offDone = window.api.onRagDone(() => setLoading(false))

    return () => {
      offSources()
      offToken()
      offError()
      offDone()
    }
  }, [])

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <>
      <div className="titlebar" />
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
        <button onClick={loading ? () => window.api.abortRagChat() : handleSend}>
          {loading ? 'Stop' : 'Send'}
        </button>
      </div>
    </>
  )
}

export default App
