'use client'
import { useState, useEffect, use } from 'react'
import { Printer, ArrowLeft, Loader2, Target } from 'lucide-react'
import Link from 'next/link'
import type { Book, Chapter, Section, LearningObjective } from '@/types'

type SectionFull = Section & { objectives: LearningObjective[] }
type ChapterFull = Chapter & { objectives: LearningObjective[]; sections: SectionFull[] }
interface ExportData { book: Book; chapters: ChapterFull[] }

const DIM_LABELS: Record<string, string> = {
  remember: '记忆', understand: '理解', apply: '应用', analyze: '分析', evaluate: '评价', create: '创造',
}
// 认知维度配色（打印友好，浅底深字）
const DIM_CLS: Record<string, string> = {
  remember: 'bg-slate-100 text-slate-600', understand: 'bg-sky-100 text-sky-700',
  apply: 'bg-emerald-100 text-emerald-700', analyze: 'bg-amber-100 text-amber-700',
  evaluate: 'bg-violet-100 text-violet-700', create: 'bg-rose-100 text-rose-700',
}

export default function OutlinePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<ExportData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/books/${id}/export`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('加载失败')))
      .then(setData).catch(e => setError(e.message))
  }, [id])

  useEffect(() => {
    if (data && new URLSearchParams(window.location.search).has('autoprint')) {
      const t = setTimeout(() => window.print(), 500)
      return () => clearTimeout(t)
    }
  }, [data])

  if (error) return <Centered><p className="text-red-600 text-sm">{error}</p></Centered>
  if (!data) return <Centered><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></Centered>

  const { book, chapters } = data
  const secCount = chapters.reduce((n, c) => n + c.sections.length, 0)
  // 全书去重目标总数（章 + 节覆盖到的目标）
  const allObj = new Map<string, LearningObjective>()
  for (const c of chapters) {
    for (const o of c.objectives) allObj.set(o.id, o)
    for (const s of c.sections) for (const o of s.objectives) allObj.set(o.id, o)
  }
  const dimCount: Record<string, number> = {}
  for (const o of allObj.values()) dimCount[o.cognitive_dimension] = (dimCount[o.cognitive_dimension] ?? 0) + 1

  return (
    <div className="print-root bg-zinc-100 min-h-screen">
      <div className="no-print sticky top-0 z-10 bg-white border-b border-zinc-200 px-6 py-3 flex items-center gap-3">
        <Link href={`/books/${id}`} className="flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="w-4 h-4" />返回工作台
        </Link>
        <div className="flex-1" />
        <span className="text-[12px] text-zinc-400">{chapters.length} 章 · {secCount} 节 · {allObj.size} 个学习目标</span>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          <Printer className="w-4 h-4" />打印 / 存为 PDF
        </button>
      </div>
      <p className="no-print text-center text-[12px] text-zinc-400 py-2">
        提示：在打印对话框「目标打印机」选「另存为 PDF」即可导出教学大纲。
      </p>

      <div className="mx-auto my-6 print:my-0 bg-white shadow-lg print:shadow-none page-sheet px-14 py-12">
        {/* 抬头 */}
        <header className="mb-8 pb-5 border-b-2 border-zinc-800">
          <p className="text-[12px] text-zinc-400 mb-1">教学大纲 · 学习目标覆盖</p>
          <h1 className="text-[26px] font-bold text-zinc-900">{book.title}</h1>
          <div className="flex items-center gap-4 mt-3 text-[12px] text-zinc-500">
            <span>{book.audience_grade} · {book.audience_age}</span>
            <span>{chapters.length} 章 / {secCount} 节</span>
            <span>共 {allObj.size} 个学习目标</span>
          </div>
          {/* 认知维度分布概览 */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {Object.entries(dimCount).map(([d, n]) => (
              <span key={d} className={`text-[11px] px-2 py-0.5 rounded ${DIM_CLS[d] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {DIM_LABELS[d] ?? d} {n}
              </span>
            ))}
          </div>
        </header>

        {/* 逐章大纲 */}
        {chapters.map(ch => (
          <section key={ch.id} className="chapter-block mb-8">
            <h2 className="text-[18px] font-bold text-zinc-900 border-l-4 border-blue-500 pl-3 mb-2">{ch.title}</h2>
            {ch.summary && <p className="text-[12.5px] text-zinc-600 leading-relaxed mb-2 pl-3">{ch.summary}</p>}
            <ObjChips objectives={ch.objectives} label="本章覆盖目标" />

            <div className="mt-4 pl-3 space-y-4">
              {ch.sections.map(s => (
                <div key={s.id} className="section-block border-l border-zinc-200 pl-4">
                  <h3 className="text-[14px] font-semibold text-zinc-800">{s.title}</h3>
                  {s.brief && <p className="text-[12px] text-zinc-500 leading-relaxed mt-1">{s.brief}</p>}
                  <ObjChips objectives={s.objectives} label="本节覆盖目标" small />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <PrintStyles />
    </div>
  )
}

function ObjChips({ objectives, label, small }: { objectives: LearningObjective[]; label: string; small?: boolean }) {
  if (!objectives.length) return null
  return (
    <div className={`avoid-break ${small ? 'mt-2' : 'mt-2 pl-3'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Target className="w-3 h-3 text-amber-500" />
        <span className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wide">{label}（{objectives.length}）</span>
      </div>
      <div className="space-y-1">
        {objectives.map(o => (
          <div key={o.id} className="obj-row flex items-start gap-2">
            <span className={`shrink-0 text-[10px] px-1.5 py-px rounded mt-px ${DIM_CLS[o.cognitive_dimension] ?? 'bg-zinc-100 text-zinc-600'}`}>
              {DIM_LABELS[o.cognitive_dimension] ?? o.cognitive_dimension}
            </span>
            <span className="text-[12px] text-zinc-700 leading-snug">{o.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-zinc-50">{children}</div>
}

function PrintStyles() {
  return (
    <style>{`
      .page-sheet { width: 210mm; }
      @media screen { .page-sheet { border-radius: 6px; } }
      @media print {
        @page { size: A4; margin: 14mm; }
        html, body { background: #fff !important; }
        .no-print { display: none !important; }
        .page-sheet { width: auto; margin: 0; padding: 0; box-shadow: none; }
        /* 只让最小原子单元不被拆分：单条目标、标题不与后文断开。
           大块（章/节）允许自然跨页流动，避免整块被推到下一页留下大片空白。 */
        .obj-row { break-inside: avoid; page-break-inside: avoid; }
        h2, h3 { break-after: avoid; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `}</style>
  )
}
