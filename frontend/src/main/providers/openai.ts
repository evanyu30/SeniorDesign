import OpenAI from 'openai'
import type { Provider, ChatOptions } from './types'

const client = new OpenAI({
  apiKey: import.meta.env.MAIN_VITE_OPENAI_API_KEY
})

export const openaiProvider: Provider = {
  id: 'openai',
  models: ['gpt-4o-mini', 'gpt-4o'],

  async chat({ messages, model, onDelta, signal }: ChatOptions): Promise<void> {
    const stream = await client.chat.completions.create(
      { model, messages, stream: true },
      { signal }
    )
    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content
      if (delta) onDelta(delta)
    }
  }
}
