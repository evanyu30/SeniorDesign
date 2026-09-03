import { ElectronAPI } from '@electron-toolkit/preload'
import { ChatSource } from '../shared/types'

export interface Api {
  setTheme: (source: 'system' | 'light' | 'dark') => Promise<boolean>
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
