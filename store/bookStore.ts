import { create } from 'zustand'
import type { Book, Chapter, Section, Skeleton, KnowledgeUnit, AlignmentEntry, LearningObjective, ObjectiveLibrary } from '@/types'

interface BookState {
  books: Book[]
  currentBook: Book | null
  chapters: Chapter[]
  sections: Section[]
  skeleton: Skeleton | null
  knowledgeUnits: KnowledgeUnit[]
  alignments: AlignmentEntry[]
  objectives: LearningObjective[]
  libraries: ObjectiveLibrary[]
  selectedObjectiveIds: string[]
  coverage: Record<string, number>
  sourceStats: Record<string, number>
  isLoading: boolean
  error: string | null

  fetchBooks: () => Promise<void>
  fetchBook: (id: string) => Promise<void>
  fetchObjectives: (libraryId?: string) => Promise<void>
  setSelectedObjectiveIds: (ids: string[]) => void
  createBook: (data: Partial<Book>) => Promise<Book>
  deleteBook: (id: string) => Promise<void>
  parseBook: (bookId: string, text: string, fileName: string) => Promise<{ skeletonId: string; unitCount: number }>
  alignObjectives: (skeletonId: string, objectiveIds: string[]) => Promise<AlignmentEntry[]>
  generateToc: (bookId: string, objectiveIds: string[]) => Promise<void>
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  currentBook: null,
  chapters: [],
  sections: [],
  skeleton: null,
  knowledgeUnits: [],
  alignments: [],
  objectives: [],
  libraries: [],
  selectedObjectiveIds: [],
  coverage: {},
  sourceStats: {},
  isLoading: false,
  error: null,

  fetchBooks: async () => {
    set({ isLoading: true })
    const res = await fetch('/api/books')
    const books = await res.json()
    set({ books, isLoading: false })
  },

  fetchBook: async (id) => {
    set({ isLoading: true })
    const res = await fetch(`/api/books/${id}`)
    if (!res.ok) { set({ isLoading: false, error: 'not found' }); return }
    const { book, chapters, sections, skeleton, knowledgeUnits, coverage, sourceStats } = await res.json()
    set({ currentBook: book, chapters, sections, skeleton, knowledgeUnits, coverage: coverage ?? {}, sourceStats: sourceStats ?? {}, isLoading: false })
  },

  fetchObjectives: async (libraryId) => {
    const url = libraryId ? `/api/objectives?library_id=${libraryId}` : '/api/objectives'
    const res = await fetch(url)
    const { libraries, objectives } = await res.json()
    set({ libraries, objectives })
  },

  setSelectedObjectiveIds: (ids) => set({ selectedObjectiveIds: ids }),

  createBook: async (data) => {
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const book = await res.json()
    set(s => ({ books: [book, ...s.books] }))
    return book
  },

  deleteBook: async (id) => {
    await fetch(`/api/books/${id}`, { method: 'DELETE' })
    set(s => ({ books: s.books.filter(b => b.id !== id) }))
  },

  parseBook: async (bookId, text, fileName) => {
    set({ isLoading: true })
    const res = await fetch('/api/ai/parse-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, text, fileName }),
    })
    const result = await res.json()
    await get().fetchBook(bookId)
    return result
  },

  alignObjectives: async (skeletonId, objectiveIds) => {
    const res = await fetch('/api/ai/align-objectives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skeletonId, objectiveIds }),
    })
    const { alignments } = await res.json()
    set({ alignments })
    return alignments
  },

  // 流式目录生成：NDJSON 逐章推入 store，看板实时长出来
  generateToc: async (bookId, objectiveIds) => {
    set({ isLoading: true, error: null })
    const res = await fetch('/api/ai/generate-toc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, objectiveIds }),
    })
    if (!res.ok || !res.body) { set({ isLoading: false, error: '目录生成失败' }); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        try {
          const evt = JSON.parse(line)
          if (evt.type === 'chapter') {
            const { sections: chSections, ...chapter } = evt.chapter
            set(s => ({
              chapters: [...s.chapters, chapter],
              sections: [...s.sections, ...(chSections ?? [])],
            }))
          } else if (evt.type === 'error') {
            set({ error: evt.message })
          }
        } catch { /* skip */ }
      }
    }
    set({ isLoading: false })
  },
}))
