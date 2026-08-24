import { ElectronAPI } from '@electron-toolkit/preload'
import { Message } from '../shared/types'

export interface Api {
  getVersion: () => Promise<string>
  sendChat: (messages: Message[], providerId: string, model: string) => Promise<void>
  listProviders: () => Promise<{ id: string; models: string[] }[]>
  onChunk: (cb: (delta: string) => void) => () => void
  onDone: (cb: () => void) => () => void
  abortChat: () => void
  setTheme: (source: 'system' | 'light' | 'dark') => Promise<boolean>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
