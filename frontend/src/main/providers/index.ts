import { anthropicProvider } from './anthropic'
import { openaiProvider } from './openai'
import type { Provider } from './types'

export const providers: Record<string, Provider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider
}

export const getProvider = (id: string): Provider => {
  const p = providers[id]
  if (!p) throw new Error(`Unknown Provider: ${id}`)
  return p
}
