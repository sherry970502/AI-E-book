'use client'
import { useState, useEffect, use } from 'react'
import { ArrowLeft, Loader2, Copy, Check, ChevronDown, Cpu } from 'lucide-react'
import Link from 'next/link'

interface PromptNode {
  id: string; title: string; stage: string; fires: string; route: string
  system: string; user: string; real: boolean; note?: string
}
interface Data { book: { title: string; genre: string; style: string }; model: string; nodes: PromptNode[] }

const STAGE_ORDER = ['起草与解析', '大纲与目标', '正文', '辅助']
const STAGE_CLS: Record<string, string> = {
  '起草与解析': 'bg-purple-100 text-purple-700',
  '大纲与目标': 'bg-blue-100 text-blue-700',
  '正文': 'bg-emerald-100 text-emerald-700',
  '辅助': 'bg-amber-100 text-amber-700',
}

export default function PromptsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/books/${id}/prompts`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('加载失败')))
      .then((d: Data) => { setData(d); setOpen(new Set(d.nodes.map(n => n.id))) })
      .catch(e => setError(e.message))
  }, [id])

  if (error) return <Centered><p className="text-red-600 text-sm">{error}</p></Centered>
  if (!data) return <Centered><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></Centered>

  const toggle = (nid: string) => setOpen(p => { const n = new Set(p); n.has(nid) ? n.delete(nid) : n.add(nid); return n })

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-200 px-6 py-3 flex items-center gap-3">
        <Link href={`/books/${id}`} className="flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="w-4 h-4" />返回工作台
        </Link>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5 text-[12px] text-zinc-400">
          <Cpu className="w-3.5 h-3.5" />模型 {data.model}
        </span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-[19px] font-bold text-zinc-800">提示词检查器</h1>
        <p className="text-[12.5px] text-zinc-500 mt-1 leading-relaxed">
          全部 {data.nodes.length} 个 AI 节点的系统提示 + 用户提示，已用《{data.book.title}》的真实数据填好。
          标「示例输入」的节点因输入尚未落库（如你输入的一句话、上传的文本），用示例值展示模板。
        </p>

        {STAGE_ORDER.map(stage => {
          const items = data.nodes.filter(n => n.stage === stage)
          if (!items.length) return null
          return (
            <section key={stage} className="mt-7">
              <h2 className="flex items-center gap-2 text-[13px] font-bold text-zinc-700 mb-3">
                <span className={`text-[11px] px-2 py-0.5 rounded ${STAGE_CLS[stage]}`}>{stage}</span>
                <span className="text-zinc-300">·</span><span className="text-zinc-400 font-normal">{items.length} 个节点</span>
              </h2>
              <div className="space-y-3">
                {items.map(n => (
                  <div key={n.id} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                    <button onClick={() => toggle(n.id)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-zinc-50/70 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13.5px] font-semibold text-zinc-800">{n.title}</span>
                          {!n.real && <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-px rounded">示例输入</span>}
                        </div>
                        <p className="text-[11.5px] text-zinc-400 mt-0.5">{n.fires} · <code className="text-zinc-500">{n.route}</code></p>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${open.has(n.id) ? 'rotate-180' : ''}`} />
                    </button>
                    {open.has(n.id) && (
                      <div className="px-5 pb-5 space-y-3 border-t border-zinc-100 pt-4">
                        {n.note && <p className="text-[12px] text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2 leading-relaxed">{n.note}</p>}
                        <PromptBlock label="系统提示 (system)" text={n.system} />
                        <PromptBlock label="用户提示 (user)" text={n.user} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{label}</span>
        <button onClick={copy} className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-blue-600 transition-colors">
          {copied ? <><Check className="w-3 h-3" />已复制</> : <><Copy className="w-3 h-3" />复制</>}
        </button>
      </div>
      <pre className="text-[12px] leading-relaxed text-zinc-700 bg-zinc-50 border border-zinc-150 border-zinc-200 rounded-lg p-3.5 overflow-x-auto whitespace-pre-wrap break-words font-mono">{text || '（空）'}</pre>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-zinc-50">{children}</div>
}
