export type Message = {
  role: 'user' | 'assistant'
  content: string
}

// Mirrors the /health response shape in app/main.py on the backend.
// Kept optional where the backend's early-return path (store failed to
// construct at all) sends a smaller object -- see main.py's two return
// statements in health(). If you tighten that on the backend, tighten this too.
export type BackendHealth = {
  status: 'ok' | 'degraded'
  store: string
  store_reachable?: boolean
  dataverse?: string
  dataset?: string
  rows?: number | null
  dim?: number | null
  detail?: string | null
}
