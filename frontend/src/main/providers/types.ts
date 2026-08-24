import type { Message } from '../../shared/types'

export type ChatOptions = {
  messages: Message[]
  model: string
  onDelta: (text: string) => void
  signal: AbortSignal
}

export interface Provider {
  id: string
  models: string[]
  chat: (opts: ChatOptions) => Promise<void>
}
