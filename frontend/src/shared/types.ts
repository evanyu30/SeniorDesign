export type Message = {
  role: 'user' | 'assistant'
  content: string
}

// One retrieved chunk, as sent in /chat's "sources" SSE event.
export type ChatSource = {
  id: string
  paper_id: string
  title: string | null
  authors: string | null
  year: number | null
  page: number | null
  text: string
  distance: number | null
  score: number | null
}
