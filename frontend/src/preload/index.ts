import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ChatSource } from '../shared/types'

// Custom APIs for renderer
const api = {
  setTheme: (source: 'system' | 'light' | 'dark'): Promise<boolean> =>
    ipcRenderer.invoke('theme:set', source),

  // The RAG chat: sends a question, then the events below stream the answer.
  sendRagChat: (question: string): Promise<void> => ipcRenderer.invoke('rag:chat', question),
  abortRagChat: (): void => ipcRenderer.send('rag:abort'),

  onRagSources: (cb: (data: { metric: string; results: ChatSource[] }) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: { metric: string; results: ChatSource[] }): void =>
      cb(data)
    ipcRenderer.on('rag:sources', listener)
    return () => ipcRenderer.removeListener('rag:sources', listener)
  },

  onRagToken: (cb: (text: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: { text: string }): void => cb(data.text)
    ipcRenderer.on('rag:token', listener)
    return () => ipcRenderer.removeListener('rag:token', listener)
  },

  onRagError: (cb: (detail: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: { detail: string }): void => cb(data.detail)
    ipcRenderer.on('rag:error', listener)
    return () => ipcRenderer.removeListener('rag:error', listener)
  },

  onRagDone: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('rag:done', listener)
    return () => ipcRenderer.removeListener('rag:done', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
