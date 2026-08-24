import Anthropic from '@anthropic-ai/sdk'
import type { Provider, ChatOptions } from './types'

const client = new Anthropic({
  apiKey: import.meta.env.MAIN_VITE_ANTHROPIC_API_KEY
})

export const anthropicProvider: Provider = {
  id: 'anthropic',
  models: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
  async chat({ messages, model, onDelta, signal }: ChatOptions): Promise<void> {
    const stream = await client.messages.create(
      { model, messages, max_tokens: 4096, stream: true },
      { signal }
    )

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onDelta(event.delta.text)
      }
    }
  }
}
