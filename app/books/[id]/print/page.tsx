'use client'
import { useState, useEffect, use } from 'react'
import ReactMarkdown from 'react-markdown'
import { Printer, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { Book, BookCover, Chapter, Section, Paragraph, Illustration, Question, LearningObjective } from '@/types'

type SectionFull = Section & {
  paragraphs: Paragraph[]
  illustrations: Illustration[]
  questions: Question[]
  objectives: LearningObjective[]
}
type ChapterFull = Chapter & { sections: SectionFull[] }
interface ExportData { book: Book; cover: BookCover | null; chapters: ChapterFull[] }

// 纯色打印封面配色（对应屏幕上的渐变，取端色，打印更省墨也更稳）
const COVER_HEX: Record<string, { from: string; to: string }> = {
  indigo: { from: '#4f46e5', to: '#6d28d9' },
  emerald: { from: '#059669', to: '#0f766e' },
  amber: { from: '#f59e0b', to: '#ea580c' },
  rose: { from: '#f43f5e', to: '#db2777' },
}

// 只由 [图：…] 占位单独成行的段落 → 打印时省略（真正的插图会作为图版渲染）
function isFigurePlaceholderOnly(text: string) {
  const t = text.trim()
  return /^\[图[:：][^\]]*\]$/.test(t)
}
// 去掉正文里穿插的 [图：…] 占位标记，保留其余文字
function stripFigurePlaceholders(text: string) {
  return text.replace(/\[图[:：][^\]]*\]/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

export default function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<ExportData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/books/${id}/export`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('加载失败')))
      .then(setData)
      .catch(e => setError(e.message))
  }, [id])

  // 数据就绪且 URL 带 ?autoprint 时，自动唤起打印对话框
  useEffect(() => {
    if (data && new URLSearchParams(window.location.search).has('autoprint')) {
      const t = setTimeout(() => window.print(), 600)
      return () => clearTimeout(t)
    }
  }, [data])

  if (error) return <Centered><p className="text-red-600 text-sm">{error}</p></Centered>
  if (!data) return <Centered><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></Centered>

  const { book, cover, chapters } = data
  const hex = COVER_HEX[cover?.palette ?? 'indigo'] ?? COVER_HEX.indigo
  const totalSections = chapters.reduce((n, c) => n + c.sections.length, 0)

  return (
    <div className="print-root bg-zinc-100 min-h-screen">
      {/* 屏幕上的操作条（打印时隐藏）*/}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-zinc-200 px-6 py-3 flex items-center gap-3">
        <Link href={`/books/${id}`} className="flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="w-4 h-4" />返回工作台
        </Link>
        <div className="flex-1" />
        <span className="text-[12px] text-zinc-400">{chapters.length} 章 · {totalSections} 节</span>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          <Printer className="w-4 h-4" />打印 / 存为 PDF
        </button>
      </div>
      <p className="no-print text-center text-[12px] text-zinc-400 py-2">
        提示：在打印对话框里「目标打印机」选择「另存为 PDF」，即可导出整本书。
      </p>

      {/* 纸张 */}
      <div className="mx-auto my-6 print:my-0 bg-white shadow-lg print:shadow-none page-sheet">
        {/* 封面 */}
        <section className="cover-page flex flex-col justify-center px-16"
          style={{ background: `linear-gradient(135deg, ${hex.from}, ${hex.to})`, color: '#fff' }}>
          <div className="w-16 h-1.5 rounded-full mb-8" style={{ background: 'rgba(255,255,255,.5)' }} />
          <h1 className="text-[40px] font-bold leading-tight">{book.title}</h1>
          {cover?.subtitle && <p className="text-[18px] mt-4 opacity-90">{cover.subtitle}</p>}
          {cover?.svg_content && (
            <div className="mt-10 max-w-md opacity-95 [&_svg]:w-full [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: cover.svg_content }} />
          )}
          <div className="mt-auto pt-10">
            {cover?.author_line && <p className="text-[14px] font-medium opacity-90">{cover.author_line}</p>}
            <p className="text-[12px] opacity-70 mt-1">{book.audience_grade} · AI 电子课本</p>
          </div>
        </section>

        {/* 目录 */}
        <section className="toc-page px-16 py-14">
          <h2 className="text-[24px] font-bold text-zinc-800 mb-8 pb-3 border-b-2 border-zinc-200">目录</h2>
          {chapters.map((ch, ci) => (
            <div key={ch.id} className="mb-4">
              <p className="text-[15px] font-semibold text-zinc-800">{ch.title}</p>
              <div className="pl-5 mt-1 space-y-0.5">
                {ch.sections.map(s => (
                  <p key={s.id} className="text-[13px] text-zinc-500">{s.title}</p>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* 正文 */}
        {chapters.map(ch => (
          <section key={ch.id} className="chapter px-16 py-14">
            <header className="mb-8">
              <h2 className="text-[26px] font-bold text-zinc-900">{ch.title}</h2>
              {ch.summary && <p className="text-[13px] text-zinc-500 mt-3 leading-relaxed">{ch.summary}</p>}
            </header>

            {ch.sections.map(s => (
              <div key={s.id} className="section-block mb-10">
                <h3 className="text-[19px] font-bold text-zinc-800 mb-4">{s.title}</h3>

                {s.paragraphs.length === 0 && (
                  <p className="text-[13px] text-zinc-300 italic">（本节正文尚未生成）</p>
                )}

                {s.paragraphs.map(p => {
                  if (isFigurePlaceholderOnly(p.content)) return renderIllusForParagraph(p.id, s.illustrations)
                  const clean = stripFigurePlaceholders(p.content)
                  return (
                    <div key={p.id} className="avoid-break">
                      <div className="prose max-w-none text-[13.5px] leading-[1.9]
                        prose-headings:font-bold prose-headings:text-zinc-800
                        prose-h3:text-[15.5px] prose-h3:mt-5 prose-h3:mb-2
                        prose-p:my-2.5 prose-p:text-zinc-700
                        prose-strong:text-red-700 prose-strong:font-semibold
                        prose-blockquote:not-italic prose-blockquote:border-l-[3px] prose-blockquote:border-blue-400 prose-blockquote:bg-blue-50/60 prose-blockquote:rounded-r prose-blockquote:px-4 prose-blockquote:py-1.5 prose-blockquote:text-[12.5px] prose-blockquote:my-3
                        prose-li:text-zinc-700">
                        {clean && <ReactMarkdown>{clean}</ReactMarkdown>}
                      </div>
                      {renderIllusForParagraph(p.id, s.illustrations)}
                    </div>
                  )
                })}

                {/* 未挂到任何段落的节级插图 */}
                {s.illustrations.filter(il => !il.paragraph_id).map(il => (
                  <FigureBlock key={il.id} illus={il} />
                ))}

                {/* 随堂练习 */}
                {s.questions.length > 0 && (
                  <div className="avoid-break mt-5 border border-zinc-200 rounded-lg p-4 bg-zinc-50/60">
                    <p className="text-[12px] font-bold text-zinc-500 mb-3">随堂练习</p>
                    {s.questions.map((q, qi) => (
                      <div key={q.id} className="mb-3 last:mb-0">
                        <p className="text-[13px] text-zinc-800 font-medium">{qi + 1}. {q.stem}</p>
                        <div className="pl-4 mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5">
                          {q.options.map(o => (
                            <p key={o.label} className="text-[12.5px] text-zinc-600">{o.label}. {o.text}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>

      <PrintStyles />
    </div>
  )
}

function renderIllusForParagraph(paragraphId: string, illus: Illustration[]) {
  const mine = illus.filter(il => il.paragraph_id === paragraphId)
  if (!mine.length) return null
  return <>{mine.map(il => <FigureBlock key={il.id} illus={il} />)}</>
}

function FigureBlock({ illus }: { illus: Illustration }) {
  return (
    <figure className="avoid-break my-5 text-center">
      <div className="inline-block max-w-full border border-zinc-200 rounded-lg overflow-hidden bg-white [&_svg]:w-full [&_svg]:h-auto">
        {illus.svg_content
          ? <div dangerouslySetInnerHTML={{ __html: illus.svg_content }} />
          // eslint-disable-next-line @next/next/no-img-element
          : illus.url ? <img src={illus.url} alt={illus.caption} className="max-h-80 object-contain" /> : null}
      </div>
      <figcaption className="text-[11.5px] text-zinc-500 mt-1.5">
        <span className="font-semibold">{illus.figure_number}</span>　{illus.caption}
      </figcaption>
    </figure>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-zinc-50">{children}</div>
}

// 打印专用 CSS：纸张尺寸、章节分页、避免图/练习被截断
function PrintStyles() {
  return (
    <style>{`
      .page-sheet { width: 210mm; }
      .cover-page { height: 297mm; }
      @media screen {
        .page-sheet { border-radius: 6px; overflow: hidden; }
      }
      @media print {
        @page { size: A4; margin: 0; }
        html, body { background: #fff !important; }
        .no-print { display: none !important; }
        .page-sheet { width: auto; margin: 0; box-shadow: none; }
        .cover-page { height: 100vh; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .toc-page, .chapter { break-before: page; page-break-before: always; }
        .cover-page { break-after: page; }
        .section-block, .avoid-break, figure { break-inside: avoid; page-break-inside: avoid; }
        h2, h3 { break-after: avoid; }
        /* 让蓝色重点框、封面渐变等背景色打印出来 */
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `}</style>
  )
}
