'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Wand2, CheckCircle2, Quote, X } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'

const SCOPE_LABEL: Record<string, { label: string; cls: string }> = {
  outline: { label: '大纲级', cls: 'bg-purple-100 text-purple-700' },
  chapter: { label: '章节级', cls: 'bg-blue-100 text-blue-700' },
  section: { label: '小节级', cls: 'bg-teal-100 text-teal-700' },
  paragraph: { label: '段落级', cls: 'bg-amber-100 text-amber-700' },
  none: { label: '咨询', cls: 'bg-zinc-100 text-zinc-500' },
}

interface Props {
  bookId: string
  quotedText?: string | null
  onClearQuote?: () => void
  onStructureChanged: () => void
}

export function ChatPanel({ bookId, quotedText, onClearQuote, onStructureChanged }: Props) {
  const { chatHistory, sendChat } = useEditorStore()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory.length])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)
    try {
      const { refresh } = await sendChat(bookId, text, quotedText ?? undefined)
      onClearQuote?.()
      if (refresh) onStructureChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-purple-500" />
        <div>
          <h3 className="text-[13px] font-bold text-zinc-800">AI 主编</h3>
          <p className="text-[10px] text-zinc-400">下指令直接改书——大纲、章节级修改实时生效</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {chatHistory.length === 0 && (
          <div className="text-[11.5px] text-zinc-400 leading-relaxed bg-zinc-50 rounded-xl p-3.5 space-y-1.5">
            <p className="font-medium text-zinc-500">试试对主编说：</p>
            <p>「把整本书大纲缩减为最核心的四章」</p>
            <p>「在第二章增加小节：函数的实际应用」</p>
            <p>「删除第三章」「第一章改名：走进函数世界」</p>
          </div>
        )}
        {chatHistory.map(node => (
          node.role === 'user' ? (
            <div key={node.id} className="flex justify-end">
              <div className="max-w-[85%] bg-zinc-900 text-white rounded-2xl rounded-br-md px-3.5 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap">
                {node.content}
              </div>
            </div>
          ) : (
            <div key={node.id} className="max-w-[95%]">
              {/* 操作节点卡片 */}
              <div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm">
                {node.scope && (
                  <span className={`inline-block text-[9.5px] font-medium px-1.5 py-px rounded mb-1.5 ${(SCOPE_LABEL[node.scope] ?? SCOPE_LABEL.none).cls}`}>
                    影响范围 · {(SCOPE_LABEL[node.scope] ?? SCOPE_LABEL.none).label}
                  </span>
                )}
                <p className="text-[12.5px] text-zinc-700 leading-relaxed whitespace-pre-wrap">{node.content}</p>
                {node.applied && node.applied.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1">
                    {node.applied.map((a, i) => (
                      <p key={i} className="flex items-start gap-1.5 text-[11px] text-green-700">
                        <CheckCircle2 className="w-3 h-3 shrink-0 mt-px" />{a}
                      </p>
                    ))}
                    <p className="text-[10px] text-zinc-400">✦ 看板与页码已实时刷新</p>
                  </div>
                )}
              </div>
            </div>
          )
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-zinc-400 text-[11.5px]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />主编正在解析指令并执行…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 引用卡片（选区引用到对话）*/}
      {quotedText && (
        <div className="shrink-0 mx-3 mb-1.5 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <Quote className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
          <p className="flex-1 text-[11px] text-amber-800 line-clamp-2">{quotedText}</p>
          <button onClick={onClearQuote} className="shrink-0 text-amber-400 hover:text-amber-600"><X className="w-3 h-3" /></button>
        </div>
      )}

      <div className="shrink-0 p-3 border-t border-zinc-100">
        <div className="flex items-end gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={2} placeholder={quotedText ? '针对引用的选区下指令…' : '对主编下指令…'}
            className="flex-1 text-[12.5px] border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none" />
          <button onClick={send} disabled={busy || !input.trim()}
            className="shrink-0 w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 disabled:opacity-30 transition-colors">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
