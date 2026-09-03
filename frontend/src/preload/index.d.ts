import { ElectronAPI } from '@electron-toolkit/preload'
import { Message, BackendHealth, ChatSource } from '../shared/types'

export interface Api {
  getVersion: () => Promise<string>
  sendChat: (messages: Message[], providerId: string, model: string) => Promise<void>
  listProviders: () => Promise<{ id: string; models: string[] }[]>
  onChunk: (cb: (delta: string) => void) => () => void
  onDone: (cb: () => void) => () => void
  abortChat: () => void
  setTheme: (source: 'system' | 'light' | 'dark') => Promise<boolean>
  checkBackendHealth: () => Promise<BackendHealth>
  sendRagChat: (question: string) => Promise<void>
  abortRagChat: () => void
  onRagSources: (cb: (data: { metric: string; results: ChatSource[] }) => void) => () => void
  onRagToken: (cb: (text: string) => void) => () => void
  onRagError: (cb: (detail: string) => void) => () => void
  onRagDone: (cb: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
