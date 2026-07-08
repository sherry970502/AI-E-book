'use client'
import { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { ImagePlus, Upload, Trash2, Loader2, Edit3, Check, X, RefreshCw, HelpCircle, Sparkles } from 'lucide-react'
import { DIMENSION_LABELS } from '@/components/objectives/ObjectiveLibraryPanel'
import type { Book, BookCover, Chapter, Section, Paragraph, Illustration, Question, LearningObjective, SourceTag, ContentBlock } from '@/types'
import { BLOCK_TYPE_META } from '@/types'

export type BookPageData =
  | { type: 'cover'; book: Book; cover: BookCover | null }
  | { type: 'toc'; chapters: Chapter[]; sections: Section[]; pageOfSection: Record<string, number>; pageOfChapter: Record<string, number> }
  | { type: 'chapter'; chapter: Chapter; chapterNo: number; pageNum: number }
  | { type: 'section'; section: Section; chapter: Chapter; pageNum: number; totalPages: number }
  | { type: 'index'; entries: { objective: LearningObjective; pages: number[] }[] }

export const COVER_PALETTES: Record<string, { bg: string; accent: string; text: string }> = {
  indigo: { bg: 'from-indigo-600 to-violet-700', accent: 'bg-indigo-200', text: 'text-indigo-100' },
  emerald: { bg: 'from-emerald-600 to-teal-700', accent: 'bg-emerald-200', text: 'text-emerald-100' },
  amber: { bg: 'from-amber-500 to-orange-600', accent: 'bg-amber-200', text: 'text-amber-100' },
  rose: { bg: 'from-rose-500 to-pink-600', accent: 'bg-rose-200', text: 'text-rose-100' },
}

// 版心参数由开本驱动（需求 3.1/3.4）
export const BOOK_W = { portrait: 700, landscape: 990 }

// 识别「图占位」段落：内容基本就是 [图：描述]，作为待生成配图的插槽
export function figurePlaceholderDesc(content: string): string | null {
  const m = content.trim().match(/^\[图[:：]\s*([\s\S]*?)\s*\]$/)
  return m ? (m[1] || '示意图') : null
}
export const BOOK_H = { portrait: 990, landscape: 556 }
export const PAGE_PAD = { portrait: 'px-16 py-12', landscape: 'px-20 py-10' }
export const BODY_TEXT = { portrait: 'text-[15px] leading-[1.95]', landscape: 'text-[14px] leading-[1.85]' }

export const SOURCE_TAG_META: Record<SourceTag, { label: string; bar: string; chip: string }> = {
  rewritten: { label: '原书改写', bar: 'bg-sky-400', chip: 'bg-sky-50 text-sky-600' },
  generated: { label: '全新生成', bar: 'bg-emerald-400', chip: 'bg-emerald-50 text-emerald-600' },
  'teacher-specified': { label: '老师指定', bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-600' },
}

interface Props {
  page: BookPageData
  orientation: 'portrait' | 'landscape'
  scale: number
  paragraphs: Paragraph[]
  illustrations: Illustration[]
  questions: Question[]
  objectives: LearningObjective[]
  showSourceTags: boolean
  sourceFilter: SourceTag | 'all'
  highlightObjectiveId: string | null
  highlightParagraphId: string | null
  /** 点段落反查出的目标（检视条上亮起） */
  reverseHighlightIds?: string[]
  /** 点检视条目标 → 高亮呈现它的段落 */
  onTraceObjective?: (id: string | null) => void
  streamingContent?: string
  isStreaming?: boolean
  isGeneratingQuestions?: boolean
  onSelectPage?: (idx: number) => void
  onParagraphClick?: (p: Paragraph) => void
  onGenerateSection?: (id: string) => void
  onSaveContent?: (sectionId: string, content: string) => Promise<void>
  onGenerateQuestions?: (sectionId: string, paragraphText?: string) => void
  onInsertIllustration?: (illus: Illustration) => void
  onDeleteIllustration?: (id: string) => void
  onRegenerateIllustration?: (illus: Illustration) => void
  onMoveIllustration?: (illusId: string, paragraphId: string) => void
}

export function BookPage(props: Props) {
  const { page, orientation, scale } = props
  const bw = BOOK_W[orientation]
  const bh = BOOK_H[orientation]
  return (
    <div className="bg-white shadow-2xl overflow-hidden"
      style={{ width: bw, height: bh, transform: `scale(${scale})`, transformOrigin: 'top center', borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)' }}>
      {page.type === 'cover' && <CoverPage page={page} />}
      {page.type === 'toc' && <TOCPage {...props} page={page} />}
      {page.type === 'chapter' && <ChapterOpenerPage page={page} orientation={orientation} />}
      {page.type === 'section' && <SectionPage {...props} page={page} />}
      {page.type === 'index' && <IndexPage page={page} orientation={orientation} onSelectPage={props.onSelectPage} />}
    </div>
  )
}

// ─── 封面页 ───────────────────────────────────────────────────────────────────
function CoverPage({ page }: { page: Extract<BookPageData, { type: 'cover' }> }) {
  const { book, cover } = page
  const palette = COVER_PALETTES[cover?.palette ?? 'indigo'] ?? COVER_PALETTES.indigo
  return (
    <div className={`h-full flex flex-col bg-gradient-to-br ${palette.bg} text-white relative overflow-hidden`}>
      {cover?.svg_content && (
        <div className="absolute inset-x-0 bottom-0 h-[45%] opacity-90 [&_svg]:w-full [&_svg]:h-full"
          dangerouslySetInnerHTML={{ __html: cover.svg_content }} />
      )}
      <div className="relative z-10 flex-1 flex flex-col px-14 pt-20">
        <div className={`w-14 h-1 ${palette.accent} rounded-full mb-8`} />
        <h1 className="text-[38px] font-bold leading-tight tracking-tight">{book.title}</h1>
        {cover?.subtitle && <p className={`text-[16px] mt-4 ${palette.text}`}>{cover.subtitle}</p>}
        <div className="flex-1" />
        <div className="pb-14 space-y-1">
          {cover?.author_line && <p className={`text-[13px] font-medium ${palette.text}`}>{cover.author_line}</p>}
          <p className={`text-[11px] opacity-70 ${palette.text}`}>{book.audience_grade} · AI 电子课本</p>
        </div>
      </div>
    </div>
  )
}

// ─── 索引页（学习目标 → 页码）─────────────────────────────────────────────────
function IndexPage({ page, orientation, onSelectPage }: {
  page: Extract<BookPageData, { type: 'index' }>
  orientation: 'portrait' | 'landscape'
  onSelectPage?: (idx: number) => void
}) {
  return (
    <div className={`flex flex-col h-full ${PAGE_PAD[orientation]}`}>
      <h1 className="text-[26px] font-bold text-zinc-900 tracking-tight">索引</h1>
      <p className="text-[11px] text-zinc-400 mt-1">学习目标 → 覆盖页码</p>
      <div className="w-12 h-0.5 bg-zinc-900 mt-2 mb-7" />
      <div className={`flex-1 overflow-y-auto ${orientation === 'landscape' ? 'columns-2 gap-12' : ''}`}>
        {page.entries.map(({ objective, pages }) => (
          <div key={objective.id} className="flex items-baseline mb-2.5 break-inside-avoid">
            <span className="text-[12.5px] text-zinc-700 leading-snug">{objective.description}</span>
            <span className="flex-1 mx-2 border-b border-dotted border-zinc-200 translate-y-[-3px] min-w-[16px]" />
            <span className="shrink-0 text-[12px] text-zinc-500 tabular-nums space-x-1">
              {pages.map(p => (
                <button key={p} onClick={() => onSelectPage?.(p)} className="hover:text-blue-600 hover:underline">{p + 1}</button>
              ))}
            </span>
          </div>
        ))}
        {page.entries.length === 0 && <p className="text-[13px] text-zinc-400 mt-8">生成正文后，此处自动汇总学习目标索引。</p>}
      </div>
    </div>
  )
}

// ─── 目录页 ───────────────────────────────────────────────────────────────────
function TOCPage({ page, orientation, onSelectPage }: Props & { page: Extract<BookPageData, { type: 'toc' }> }) {
  const byChapter = page.sections.reduce<Record<string, Section[]>>((a, s) => {
    ;(a[s.chapter_id] ??= []).push(s); return a
  }, {})
  return (
    <div className={`flex flex-col h-full ${PAGE_PAD[orientation]}`}>
      <h1 className="text-[26px] font-bold text-zinc-900 tracking-tight">目录</h1>
      <div className="w-12 h-0.5 bg-zinc-900 mt-2 mb-8" />
      <div className={`flex-1 overflow-hidden ${orientation === 'landscape' ? 'columns-2 gap-12' : ''}`}>
        {page.chapters.map(ch => (
          <div key={ch.id} className="mb-4 break-inside-avoid">
            <button onClick={() => onSelectPage?.(page.pageOfChapter[ch.id])}
              className="w-full flex items-baseline text-left group">
              <span className="text-[14.5px] font-bold text-zinc-800 group-hover:text-blue-700">{ch.title}</span>
              <span className="flex-1 mx-2 border-b border-dotted border-zinc-300 translate-y-[-3px]" />
              <span className="text-[13px] font-bold text-zinc-700 tabular-nums">{page.pageOfChapter[ch.id] + 1}</span>
            </button>
            {(byChapter[ch.id] ?? []).map(sec => (
              <button key={sec.id} onClick={() => onSelectPage?.(page.pageOfSection[sec.id])}
                className="w-full flex items-baseline text-left pl-5 mt-1.5 group">
                <span className="text-[12.5px] text-zinc-600 group-hover:text-blue-600">{sec.title}</span>
                <span className="flex-1 mx-2 border-b border-dotted border-zinc-200 translate-y-[-3px]" />
                <span className="text-[11.5px] text-zinc-400 tabular-nums">{page.pageOfSection[sec.id] + 1}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 章首页 ───────────────────────────────────────────────────────────────────
function ChapterOpenerPage({ page, orientation }: { page: Extract<BookPageData, { type: 'chapter' }>; orientation: 'portrait' | 'landscape' }) {
  const { chapter, chapterNo, pageNum } = page
  const bare = chapter.title.replace(/^第[一二三四五六七八九十百\d]+章\s*/, '')
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center px-16 text-center">
        <div className={`font-thin text-zinc-100 leading-none select-none ${orientation === 'portrait' ? 'text-[150px]' : 'text-[100px]'}`}>{chapterNo}</div>
        <p className="text-[10px] font-semibold tracking-[0.35em] text-zinc-400 uppercase mt-2 mb-5">Chapter {chapterNo}</p>
        <h2 className="text-[26px] font-bold text-zinc-800 leading-tight mb-5">{bare}</h2>
        <div className="w-10 h-px bg-zinc-300 mb-5" />
        {chapter.summary && <p className="text-[13.5px] text-zinc-500 leading-relaxed max-w-[360px]">{chapter.summary}</p>}
      </div>
      <div className="px-16 py-5 flex justify-center">
        <span className="text-[10px] text-zinc-400 tabular-nums">{pageNum + 1}</span>
      </div>
    </div>
  )
}

// ─── 正文页 ───────────────────────────────────────────────────────────────────
function SectionPage(props: Props & { page: Extract<BookPageData, { type: 'section' }> }) {
  const {
    page, orientation, paragraphs, illustrations, questions, objectives,
    showSourceTags, sourceFilter, highlightObjectiveId, highlightParagraphId,
    reverseHighlightIds = [], onTraceObjective,
    streamingContent, isStreaming, isGeneratingQuestions,
    onParagraphClick, onGenerateSection, onSaveContent, onGenerateQuestions,
    onInsertIllustration, onDeleteIllustration, onRegenerateIllustration, onMoveIllustration,
  } = props
  const { section, chapter, pageNum, totalPages } = page
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const objMap = Object.fromEntries(objectives.map(o => [o.id, o]))

  const displayStreaming = isStreaming && streamingContent
  const hasParagraphs = paragraphs.length > 0 && !displayStreaming

  async function saveEdit() {
    await onSaveContent?.(section.id, draft)
    setEditing(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 页眉 */}
      <div className={`shrink-0 flex items-center justify-between border-b border-zinc-100 ${orientation === 'portrait' ? 'px-16 pt-9 pb-3' : 'px-20 pt-7 pb-3'}`}>
        <span className="text-[9.5px] text-zinc-400 tracking-[0.2em] uppercase truncate max-w-[38%]">{chapter.title}</span>
        <div className="flex items-center gap-2">
          {section.content && !isStreaming && (
            editing ? (
              <>
                <button onClick={saveEdit} className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-green-600 text-white rounded hover:bg-green-700"><Check className="w-3 h-3" />保存</button>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-2 py-0.5 text-[10px] border border-zinc-200 text-zinc-500 rounded hover:bg-zinc-50"><X className="w-3 h-3" />取消</button>
              </>
            ) : (
              <button onClick={() => { setDraft(section.content ?? ''); setEditing(true) }}
                className="flex items-center gap-1 text-[10px] text-zinc-300 hover:text-zinc-600 transition-colors"><Edit3 className="w-3 h-3" />编辑</button>
            )
          )}
        </div>
        <span className="text-[9.5px] text-zinc-400 tracking-[0.2em] uppercase truncate max-w-[38%] text-right">{section.title}</span>
      </div>

      {/* 本节目标检视条：这一节定好的目标如何被呈现（点目标亮段落，点段落亮目标） */}
      {hasParagraphs && section.objective_ids.length > 0 && (
        <div className={`shrink-0 flex flex-wrap items-center gap-1.5 border-b border-amber-100/60 bg-amber-50/40 ${orientation === 'portrait' ? 'px-16' : 'px-20'} py-2`}>
          <span className="text-[9.5px] font-semibold text-amber-600/70 uppercase tracking-wider shrink-0">本节目标</span>
          {section.objective_ids.map(oid => {
            const o = objMap[oid]
            if (!o) return null
            const active = highlightObjectiveId === oid
            const reverseHit = reverseHighlightIds.includes(oid)
            const covered = paragraphs.filter(p => p.objective_ids.includes(oid)).length
            return (
              <button key={oid}
                onClick={() => onTraceObjective?.(active ? null : oid)}
                title={`${o.description}\n本节 ${covered} 段呈现该目标——点击高亮`}
                className={`inline-flex items-center gap-1 text-[10.5px] rounded-lg px-2 py-1 border transition-all ${
                  active ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium'
                    : reverseHit ? 'bg-amber-100 border-amber-300 text-amber-800 font-medium'
                      : covered ? 'bg-white border-amber-200/70 text-zinc-600 hover:border-blue-300'
                        : 'bg-white border-red-200 text-red-500'}`}>
                🎯 <span className="max-w-[200px] truncate">{o.description}</span>
                <span className={`tabular-nums ${covered ? 'text-zinc-400' : 'text-red-400'}`}>{covered ? `${covered}段` : '未呈现'}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 正文区 */}
      <div className={`flex-1 overflow-y-auto ${orientation === 'portrait' ? 'px-16 py-7' : 'px-20 py-5'}`}>
        {editing ? (
          <textarea value={draft} onChange={e => setDraft(e.target.value)}
            className="w-full h-full min-h-[400px] text-[13px] leading-relaxed font-mono text-zinc-700 bg-zinc-50 rounded-lg p-4 border border-zinc-200 focus:outline-none resize-none"
            placeholder="Markdown 正文…" />
        ) : displayStreaming ? (
          <MarkdownBlock content={streamingContent!} orientation={orientation} />
        ) : hasParagraphs ? (
          <>
            {paragraphs.map(p => (
              <ParagraphBlock key={p.id} paragraph={p}
                orientation={orientation}
                objMap={objMap}
                showSourceTag={showSourceTags}
                dimmed={sourceFilter !== 'all' && p.source_tag !== sourceFilter}
                highlighted={
                  (highlightObjectiveId ? p.objective_ids.includes(highlightObjectiveId) : false) ||
                  highlightParagraphId === p.id
                }
                illustrations={illustrations.filter(il => il.paragraph_id === p.id)}
                sectionId={section.id}
                sectionTitle={section.title}
                onClick={() => onParagraphClick?.(p)}
                onGenerateQuestions={onGenerateQuestions}
                onInsertIllustration={onInsertIllustration}
                onDeleteIllustration={onDeleteIllustration}
                onRegenerateIllustration={onRegenerateIllustration}
                onMoveIllustration={onMoveIllustration}
              />
            ))}
            {/* 未挂到段落的插图 */}
            {illustrations.filter(il => !il.paragraph_id).map(il => (
              <IllustrationCard key={il.id} illus={il} onDelete={onDeleteIllustration} onRegenerate={onRegenerateIllustration} />
            ))}

            {/* 随堂测试 */}
            <SectionQuiz
              sectionId={section.id} questions={questions} objMap={objMap}
              isGenerating={!!isGeneratingQuestions}
              onGenerate={() => onGenerateQuestions?.(section.id)} />
          </>
        ) : section.content ? (
          <MarkdownBlock content={section.content} orientation={orientation} />
        ) : isStreaming ? (
          <div className="flex items-center gap-3 mt-14 text-zinc-400">
            <span className="flex gap-1">
              {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
            </span>
            <span className="text-[13px]">AI 正在撰写…</span>
          </div>
        ) : (
          <SectionDesignCard section={section} objMap={objMap} onGenerate={onGenerateSection} />
        )}
      </div>

      {/* 页脚 */}
      <div className={`shrink-0 flex items-center justify-center border-t border-zinc-100 ${orientation === 'portrait' ? 'px-16 py-4' : 'px-20 py-3'}`}>
        <span className="text-[10.5px] text-zinc-400 tabular-nums">第 {pageNum + 1} / {totalPages} 页</span>
      </div>
    </div>
  )
}

// ─── 内容设计卡：两阶段——①AI 设计正文脉络 ②老师逐颗粒确认后生成 ────────────
function SectionDesignCard({ section, objMap, onGenerate }: {
  section: Section
  objMap: Record<string, LearningObjective>
  onGenerate?: (id: string) => void
}) {
  const [brief, setBrief] = useState(section.brief)
  const [editingBrief, setEditingBrief] = useState(false)
  const [blocks, setBlocks] = useState<ContentBlock[]>(section.block_plan ?? [])
  const [planning, setPlanning] = useState(false)

  async function saveBrief() {
    setEditingBrief(false)
    if (brief.trim() !== section.brief) {
      await fetch(`/api/sections/${section.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: brief.trim() }),
      })
    }
  }

  async function designPlan() {
    setPlanning(true)
    try {
      const res = await fetch('/api/ai/section-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: section.id }),
      })
      if (res.ok) setBlocks((await res.json()).blocks)
    } finally {
      setPlanning(false)
    }
  }

  async function savePlan(next: ContentBlock[]) {
    setBlocks(next)
    await fetch(`/api/sections/${section.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_plan: next }),
    })
  }

  const enabledCount = blocks.filter(b => b.enabled).length

  return (
    <div className="max-w-lg mx-auto mt-6 border-2 border-dashed border-zinc-200 rounded-2xl p-6 space-y-5">
      <div className="text-center">
        <p className="text-[13px] font-bold text-zinc-700">本节内容设计</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">教学要点 → AI 设计正文脉络 → 逐颗粒确认 → 生成正文</p>
      </div>

      {/* 教学要点 */}
      <div>
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">教学要点</p>
        {editingBrief ? (
          <div className="space-y-1.5">
            <textarea value={brief} onChange={e => setBrief(e.target.value)} autoFocus rows={3}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveBrief() } }}
              className="w-full text-[12.5px] border border-blue-300 rounded-lg px-3 py-2 focus:outline-none resize-none" />
            <div className="flex gap-1.5 justify-end">
              <button onClick={saveBrief} className="flex items-center gap-1 text-[11px] bg-green-600 text-white rounded-md px-2.5 py-1"><Check className="w-3 h-3" />保存</button>
              <button onClick={() => { setBrief(section.brief); setEditingBrief(false) }} className="text-[11px] border border-zinc-200 text-zinc-500 rounded-md px-2.5 py-1">取消</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditingBrief(true)}
            className="w-full text-left text-[12.5px] leading-relaxed rounded-lg px-3 py-2 border border-zinc-100 bg-zinc-50/60 hover:border-blue-200 hover:bg-blue-50/40 transition-colors group">
            <span className={brief ? 'text-zinc-600' : 'text-zinc-300 italic'}>{brief || '尚未填写——点击填写本节讲什么'}</span>
            <Edit3 className="inline w-3 h-3 ml-1.5 text-zinc-300 group-hover:text-blue-400" />
          </button>
        )}
      </div>

      {/* 覆盖目标 */}
      <div>
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">覆盖的学习目标（在大纲视图调整）</p>
        <div className="space-y-1">
          {section.objective_ids.map(oid => objMap[oid] && (
            <p key={oid} className="flex items-start gap-1.5 text-[11.5px] text-zinc-600">
              <span className="text-amber-400 mt-px">🎯</span>{objMap[oid].description}
            </p>
          ))}
          {section.objective_ids.length === 0 && <p className="text-[11px] text-red-400">⚠ 未关联目标——建议先回大纲视图补上</p>}
        </div>
      </div>

      {/* 正文脉络：教学颗粒序列 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">正文脉络（教学颗粒）</p>
          {blocks.length > 0 && (
            <button onClick={designPlan} disabled={planning}
              className="flex items-center gap-1 text-[10.5px] text-purple-500 hover:text-purple-700 disabled:opacity-50">
              {planning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}重新设计
            </button>
          )}
        </div>

        {blocks.length === 0 ? (
          <button onClick={designPlan} disabled={planning}
            className="w-full flex items-center justify-center gap-2 py-3 text-[12.5px] bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 font-medium transition-all">
            {planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {planning ? 'AI 正在设计脉络…' : '① AI 设计正文脉络'}
          </button>
        ) : (
          <ul className="space-y-1.5">
            {blocks.map(b => {
              const meta = BLOCK_TYPE_META[b.type]
              return (
                <li key={b.id}
                  className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 transition-all ${b.enabled ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50 opacity-50'}`}>
                  <input type="checkbox" checked={b.enabled}
                    onChange={() => savePlan(blocks.map(x => x.id === b.id ? { ...x, enabled: !x.enabled } : x))}
                    className="mt-1 rounded accent-blue-600 cursor-pointer" title={b.enabled ? '取消此颗粒' : '启用此颗粒'} />
                  <span className={`shrink-0 mt-0.5 text-[10px] font-medium px-1.5 py-px rounded border ${meta.cls}`}>
                    {meta.emoji} {meta.label}
                  </span>
                  <EditableDesc value={b.desc} strikethrough={!b.enabled}
                    onSave={v => savePlan(blocks.map(x => x.id === b.id ? { ...x, desc: v } : x))} />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {blocks.length > 0 && onGenerate && (
        <button onClick={() => onGenerate(section.id)} disabled={enabledCount === 0}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[13px] bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 font-medium transition-colors">
          <Check className="w-4 h-4" />② 确认脉络（{enabledCount} 个颗粒），生成正文
        </button>
      )}
    </div>
  )
}

function EditableDesc({ value, onSave, strikethrough }: { value: string; onSave: (v: string) => void; strikethrough?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (editing) {
    return (
      <input value={draft} autoFocus onChange={e => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft.trim() && draft !== value) onSave(draft.trim()) }}
        onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); if (draft.trim() && draft !== value) onSave(draft.trim()) } if (e.key === 'Escape') setEditing(false) }}
        className="flex-1 text-[11.5px] text-zinc-700 border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none" />
    )
  }
  return (
    <button onClick={() => { setDraft(value); setEditing(true) }}
      className={`flex-1 text-left text-[11.5px] leading-snug text-zinc-600 hover:text-blue-700 ${strikethrough ? 'line-through' : ''}`}
      title="点击修改此颗粒的内容描述">
      {value}
    </button>
  )
}

// ─── 段落块：目标点 + 溯源色条 + 高亮 + 悬停操作 ─────────────────────────────
function ParagraphBlock({
  paragraph, orientation, objMap, showSourceTag, dimmed, highlighted, illustrations,
  sectionId, sectionTitle, onClick, onGenerateQuestions,
  onInsertIllustration, onDeleteIllustration, onRegenerateIllustration, onMoveIllustration,
}: {
  paragraph: Paragraph
  orientation: 'portrait' | 'landscape'
  objMap: Record<string, LearningObjective>
  showSourceTag: boolean
  dimmed: boolean
  highlighted: boolean
  illustrations: Illustration[]
  sectionId: string
  sectionTitle: string
  onClick: () => void
  onGenerateQuestions?: (sectionId: string, paragraphText?: string) => void
  onInsertIllustration?: (illus: Illustration) => void
  onDeleteIllustration?: (id: string) => void
  onRegenerateIllustration?: (illus: Illustration) => void
  onMoveIllustration?: (illusId: string, paragraphId: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hoverDot, setHoverDot] = useState(false)
  const [dropTarget, setDropTarget] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const tagMeta = paragraph.source_tag ? SOURCE_TAG_META[paragraph.source_tag] : null

  const callIllustration = useCallback(async (kind: 'ai' | 'upload', file?: File, opts?: { prompt?: string; caption?: string }) => {
    setBusy(true)
    try {
      let res: Response
      if (kind === 'ai') {
        res = await fetch('/api/ai/illustration', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionId, sectionTitle, paragraphId: paragraph.id,
            paragraphText: (opts?.prompt ?? paragraph.content).slice(0, 600),
            caption: opts?.caption,
          }),
        })
      } else {
        const fd = new FormData()
        fd.append('file', file!)
        fd.append('sectionId', sectionId)
        fd.append('sectionTitle', sectionTitle)
        fd.append('paragraphId', paragraph.id)
        if (opts?.caption) fd.append('caption', opts.caption)
        res = await fetch('/api/ai/illustration/upload', { method: 'POST', body: fd })
      }
      if (res.ok) onInsertIllustration?.(await res.json())
    } finally {
      setBusy(false)
    }
  }, [sectionId, sectionTitle, paragraph, onInsertIllustration])

  // 图占位插槽：内容是 [图：desc] 且尚无插图 → 渲染「待生成配图」卡片而非裸文字
  const figDesc = figurePlaceholderDesc(paragraph.content)
  const isEmptyFigureSlot = figDesc !== null && illustrations.length === 0

  return (
    <div data-pid={paragraph.id}
      className={`relative group/para transition-all duration-200 ${dimmed ? 'opacity-25' : ''} ${dropTarget ? 'ring-2 ring-blue-300 ring-offset-2 rounded-md' : ''}`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onDragOver={e => { if (e.dataTransfer.types.includes('text/illustration-id')) { e.preventDefault(); setDropTarget(true) } }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={e => {
        e.preventDefault()
        setDropTarget(false)
        const illusId = e.dataTransfer.getData('text/illustration-id')
        if (illusId) onMoveIllustration?.(illusId, paragraph.id)
      }}>
      {/* 操作工具条：悬停出现，点击段落后固定显示（显示在段落内部，避免被书页裁剪） */}
      {(hovered || highlighted) && (
        <div className="absolute right-0 -top-3 z-30 flex items-center gap-0.5 bg-white/95 backdrop-blur border border-zinc-200 rounded-lg shadow-lg px-1 py-0.5"
          onClick={e => e.stopPropagation()}>
          <BubbleBtn onClick={() => callIllustration('ai')} busy={busy} icon={<ImagePlus className="w-3 h-3" />} label="AI 配图" />
          <BubbleBtn onClick={() => uploadRef.current?.click()} busy={busy} icon={<Upload className="w-3 h-3" />} label="上传插图" />
          <BubbleBtn onClick={() => onGenerateQuestions?.(sectionId, paragraph.content)} busy={false} icon={<HelpCircle className="w-3 h-3" />} label="对本段出题" />
          <input ref={uploadRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) callIllustration('upload', f); e.target.value = '' }} />
        </div>
      )}
      {/* 左侧留白：目标微标记点 + 溯源色条 */}
      <div className="absolute -left-10 top-1.5 flex flex-col items-center gap-1 w-6">
        {paragraph.objective_ids.length > 0 && (
          <div className="relative flex flex-col gap-[3px] cursor-help py-1"
            onMouseEnter={() => setHoverDot(true)} onMouseLeave={() => setHoverDot(false)}>
            {paragraph.objective_ids.slice(0, 4).map(oid => (
              <span key={oid} className={`w-[7px] h-[7px] rounded-full transition-transform ${hoverDot ? 'scale-125' : ''} ${highlighted ? 'bg-blue-500' : 'bg-amber-400/80'}`} />
            ))}
            {hoverDot && (
              <div className="absolute left-4 top-0 z-40 w-56 bg-zinc-900 text-white rounded-lg shadow-xl p-2.5 space-y-1.5">
                {paragraph.objective_ids.map(oid => {
                  const o = objMap[oid]
                  return o ? (
                    <p key={oid} className="text-[10.5px] leading-snug">
                      <span className="text-amber-300">[{DIMENSION_LABELS[o.cognitive_dimension] ?? ''}]</span> {o.description}
                    </p>
                  ) : null
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {showSourceTag && tagMeta && (
        <span className={`absolute -left-3 top-1 bottom-1 w-[3px] rounded-full ${tagMeta.bar}`} title={tagMeta.label} />
      )}

      {/* 图占位插槽：待生成配图卡片（点一下用占位描述生成/上传，图就位后此卡自动消失）*/}
      {isEmptyFigureSlot ? (
        <div className="my-5 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/40 px-5 py-4">
          <div className="flex items-start gap-3">
            <ImagePlus className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-blue-600 mb-0.5">待生成配图</p>
              <p className="text-[12.5px] text-zinc-600 leading-relaxed">{figDesc}</p>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={e => { e.stopPropagation(); callIllustration('ai', undefined, { prompt: figDesc!, caption: figDesc! }) }} disabled={busy}
                  className="flex items-center gap-1 px-3 py-1.5 text-[11.5px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}AI 生成此图
                </button>
                <button onClick={e => { e.stopPropagation(); uploadRef.current?.click() }} disabled={busy}
                  className="flex items-center gap-1 px-3 py-1.5 text-[11.5px] border border-zinc-200 text-zinc-600 rounded-lg hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 transition-colors">
                  <Upload className="w-3 h-3" />上传
                </button>
              </div>
            </div>
          </div>
          <input ref={uploadRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) callIllustration('upload', f, { caption: figDesc! }); e.target.value = '' }} />
        </div>
      ) : figDesc !== null ? (
        /* 图占位且已配图：占位文字不再显示，图由下方渲染 */
        null
      ) : (
        /* 段落正文（点击反查目标）；引用块 = 独立的「重点说明」教学块 */
        <div onClick={onClick}
          className={`cursor-pointer rounded-md transition-all duration-200 -mx-2 px-2 ${highlighted ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-zinc-50/70'}`}>
          {paragraph.content.trimStart().startsWith('>') && (
            <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-blue-500/80 bg-blue-50 border border-blue-100 rounded px-1.5 py-px mt-3 -mb-1">
              💡 重点说明
            </span>
          )}
          <MarkdownBlock content={paragraph.content.replace(/\[图[:：][^\]]*\]/g, '').trim()} orientation={orientation} />
        </div>
      )}

      {/* 本段插图 */}
      {illustrations.map(il => (
        <IllustrationCard key={il.id} illus={il} onDelete={onDeleteIllustration} onRegenerate={onRegenerateIllustration} />
      ))}
    </div>
  )
}

function BubbleBtn({ onClick, busy, icon, label }: { onClick: () => void; busy: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} disabled={busy}
      className="flex items-center gap-1 px-2 py-1 text-[10px] bg-white border border-zinc-200 shadow-md rounded-md text-zinc-600 hover:border-blue-300 hover:text-blue-700 whitespace-nowrap transition-colors disabled:opacity-50">
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : icon}{label}
    </button>
  )
}

// ─── 插图卡片 ─────────────────────────────────────────────────────────────────
function IllustrationCard({ illus, onDelete, onRegenerate }: {
  illus: Illustration
  onDelete?: (id: string) => void
  onRegenerate?: (illus: Illustration) => void
}) {
  const [caption, setCaption] = useState(illus.caption)
  const [editing, setEditing] = useState(false)
  async function save() {
    setEditing(false)
    await fetch('/api/illustrations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: illus.id, caption }) })
  }
  return (
    <figure className="my-5 group/fig cursor-grab active:cursor-grabbing" draggable
      onDragStart={e => { e.dataTransfer.setData('text/illustration-id', illus.id); e.dataTransfer.effectAllowed = 'move' }}
      title="按住拖拽到任意段落，即可调整插图位置">
      <div className="rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50/50">
        {illus.svg_content
          ? <div className="[&_svg]:w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: illus.svg_content }} />
          // eslint-disable-next-line @next/next/no-img-element
          : illus.url ? <img src={illus.url} alt={caption} className="w-full object-contain max-h-72" /> : null}
      </div>
      <figcaption className="flex items-center justify-center gap-2 mt-2">
        {editing ? (
          <>
            <input value={caption} onChange={e => setCaption(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && save()}
              className="text-[11.5px] text-center text-zinc-600 border-b border-zinc-300 bg-transparent focus:outline-none w-64" />
            <button onClick={save}><Check className="w-3 h-3 text-green-500" /></button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="text-[11.5px] text-zinc-500 hover:text-zinc-700" title="点击编辑图注">
            <span className="font-semibold">{illus.figure_number}</span>　{caption}
          </button>
        )}
        <span className="flex gap-1 opacity-0 group-hover/fig:opacity-100 transition-opacity">
          {illus.source !== 'uploaded' && onRegenerate && (
            <button onClick={() => onRegenerate(illus)} className="text-zinc-300 hover:text-blue-500" title="重新生成"><RefreshCw className="w-3 h-3" /></button>
          )}
          <button onClick={() => onDelete?.(illus.id)} className="text-zinc-300 hover:text-red-400" title="删除"><Trash2 className="w-3 h-3" /></button>
        </span>
      </figcaption>
    </figure>
  )
}

// ─── 随堂测试 ─────────────────────────────────────────────────────────────────
function SectionQuiz({ sectionId, questions, objMap, isGenerating, onGenerate }: {
  sectionId: string
  questions: Question[]
  objMap: Record<string, LearningObjective>
  isGenerating: boolean
  onGenerate: () => void
}) {
  void sectionId
  return (
    <div className="mt-10 pt-6 border-t-2 border-zinc-100">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[13px] font-bold text-zinc-700 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-amber-500" />随堂测试
        </h4>
        <button onClick={onGenerate} disabled={isGenerating}
          className="flex items-center gap-1 text-[11px] text-amber-600 border border-amber-200 rounded-lg px-2.5 py-1 hover:bg-amber-50 transition-colors disabled:opacity-50">
          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {questions.length ? '重新出题' : '一键生成测试题'}
        </button>
      </div>
      {questions.length === 0 ? (
        <p className="text-[12px] text-zinc-300">尚未出题——点右上按钮生成，或悬停任意段落选择「对本段出题」。</p>
      ) : (
        <div className="space-y-5">
          {questions.map((q, i) => <QuizItem key={q.id} q={q} index={i} objMap={objMap} />)}
        </div>
      )}
    </div>
  )
}

function QuizItem({ q, index, objMap }: { q: Question; index: number; objMap: Record<string, LearningObjective> }) {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div>
      <p className="text-[13px] font-medium text-zinc-800 leading-snug">{index + 1}. {q.stem}</p>
      {q.objective_ids.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 mb-1.5">
          {q.objective_ids.map(oid => objMap[oid] && (
            <span key={oid} className="text-[9.5px] bg-violet-50 text-violet-600 rounded px-1.5 py-px">
              🎯 {objMap[oid].description.slice(0, 18)}{objMap[oid].description.length > 18 ? '…' : ''}
            </span>
          ))}
        </div>
      )}
      <ul className="space-y-1.5 mt-2">
        {q.options.map(opt => {
          const revealed = !!picked
          const cls = !revealed
            ? 'border-zinc-200 hover:border-blue-300 hover:bg-blue-50/40 text-zinc-700 cursor-pointer'
            : opt.is_correct ? 'border-green-400 bg-green-50 text-green-800 font-medium'
              : picked === opt.label ? 'border-red-400 bg-red-50 text-red-600'
                : 'border-zinc-100 text-zinc-300'
          return (
            <li key={opt.label}>
              <button onClick={() => !picked && setPicked(opt.label)} disabled={!!picked}
                className={`w-full text-left text-[12.5px] px-3.5 py-2 rounded-lg border transition-colors ${cls}`}>
                <span className="font-semibold mr-1.5">{opt.label}.</span>{opt.text}
              </button>
            </li>
          )
        })}
      </ul>
      {picked && q.explanation && (
        <div className="mt-2 text-[12px] text-amber-900 bg-amber-50 border-l-[3px] border-amber-400 rounded-r-lg px-3.5 py-2.5 leading-relaxed">
          <span className="font-semibold">解析</span>　{q.explanation}
        </div>
      )}
    </div>
  )
}

// ─── Markdown 渲染 ────────────────────────────────────────────────────────────
function MarkdownBlock({ content, orientation }: { content: string; orientation: 'portrait' | 'landscape' }) {
  return (
    <div className={`prose max-w-none ${BODY_TEXT[orientation]}
      prose-headings:font-bold prose-headings:text-zinc-800 prose-headings:tracking-tight
      prose-h2:text-[19px] prose-h2:mt-8 prose-h2:mb-3
      prose-h3:text-[15.5px] prose-h3:mt-6 prose-h3:mb-2.5
      prose-p:my-3 prose-p:text-zinc-700
      prose-strong:text-red-700 prose-strong:font-semibold
      prose-blockquote:not-italic prose-blockquote:border-l-[3px] prose-blockquote:border-blue-400 prose-blockquote:bg-blue-50/50 prose-blockquote:rounded-r-md prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:text-[13px] prose-blockquote:my-3
      prose-li:text-zinc-700 prose-li:my-1
      prose-code:text-[12.5px] prose-code:bg-zinc-100 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
      prose-table:text-[12.5px] prose-th:bg-zinc-50`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
