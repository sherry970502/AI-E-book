import { create } from 'zustand'
import type { Section, Question, Paragraph, Illustration } from '@/types'

export interface ChatNodeUI {
  id: string
  role: 'user' | 'assistant'
  content: string
  scope?: string
  applied?: string[]
}

interface EditorState {
  activeSection: Section | null
  paragraphs: Paragraph[]
  illustrations: Illustration[]
  questions: Question[]
  chatHistory: ChatNodeUI[]
  streamingContent: string
  isStreaming: boolean
  // 双向高亮：选中的目标 / 选中的段落
  highlightObjectiveId: string | null
  highlightParagraphId: string | null
  // 批量生成中断控制
  batchAbort: AbortController | null

  setActiveSection: (section: Section | null) => void
  setHighlightObjective: (id: string | null) => void
  setHighlightParagraph: (id: string | null) => void
  fetchSectionDetail: (sectionId: string) => Promise<void>
  generateSection: (sectionId: string, mode?: string, options?: { intent?: string; audienceNote?: string; pedagogy?: string; signal?: AbortSignal }) => Promise<boolean>
  startBatch: () => AbortController
  stopBatch: () => void
  generateQuestions: (sectionId: string, opts?: { count?: number; paragraphText?: string; append?: boolean }) => Promise<void>
  sendChat: (bookId: string, message: string, context?: string) => Promise<{ refresh: boolean }>
  clearChat: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeSection: null,
  paragraphs: [],
  illustrations: [],
  questions: [],
  chatHistory: [],
  streamingContent: '',
  isStreaming: false,
  highlightObjectiveId: null,
  highlightParagraphId: null,
  batchAbort: null,

  setActiveSection: (section) => set({ activeSection: section }),
  setHighlightObjective: (id) => set({ highlightObjectiveId: id, highlightParagraphId: null }),
  setHighlightParagraph: (id) => set({ highlightParagraphId: id, highlightObjectiveId: null }),

  fetchSectionDetail: async (sectionId) => {
    const res = await fetch(`/api/sections/${sectionId}`)
    if (!res.ok) return
    const { section, paragraphs, questions, illustrations } = await res.json()
    set({ activeSection: section, paragraphs, questions, illustrations })
  },

  generateSection: async (sectionId, mode = 'generate', options = {}) => {
    set({ isStreaming: true, streamingContent: '' })
    try {
      const res = await fetch('/api/ai/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, mode, intent: options.intent, audienceNote: options.audienceNote, pedagogy: options.pedagogy }),
        signal: options.signal,
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let content = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value)
        set({ streamingContent: content })
      }
      await get().fetchSectionDetail(sectionId)
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false
      throw e
    } finally {
      set({ isStreaming: false })
    }
  },

  startBatch: () => {
    const controller = new AbortController()
    set({ batchAbort: controller })
    return controller
  },
  stopBatch: () => {
    get().batchAbort?.abort()
    set({ batchAbort: null })
  },

  generateQuestions: async (sectionId, opts = {}) => {
    const res = await fetch('/api/ai/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, count: opts.count ?? 4, paragraphText: opts.paragraphText, append: opts.append }),
    })
    const questions = await res.json()
    if (Array.isArray(questions)) {
      set(s => opts.append ? { questions: [...s.questions, ...questions] } : { questions })
    }
  },

  // 节点式主编对话：返回 refresh 标志（true = 结构已改，外层刷新看板）
  sendChat: async (bookId, message, context) => {
    set(s => ({ chatHistory: [...s.chatHistory, { id: `u-${Date.now()}`, role: 'user', content: message }] }))
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, message, context }),
    })
    if (!res.ok) {
      set(s => ({ chatHistory: [...s.chatHistory, { id: `a-${Date.now()}`, role: 'assistant', content: '主编暂时开小差了，稍后再试。' }] }))
      return { refresh: false }
    }
    const { reply, scope, applied, refresh } = await res.json()
    set(s => ({
      chatHistory: [...s.chatHistory, { id: `a-${Date.now()}`, role: 'assistant', content: reply, scope, applied }],
    }))
    return { refresh: !!refresh }
  },

  clearChat: () => set({ chatHistory: [] }),
}))
