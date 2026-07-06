'use client'
import { useEffect, useState, useCallback, useLayoutEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Loader2, Sparkles,
  Target, Wand2, Quote, PanelLeftClose, PanelLeft, Palette, X,
} from 'lucide-react'
import { useBookStore } from '@/store/bookStore'
import { useEditorStore } from '@/store/editorStore'
import { TOCBoard } from '@/components/book/TOCBoard'
import { OutlineView } from '@/components/book/OutlineView'
import { ChatPanel } from '@/components/book/ChatPanel'
import { ObjectiveLibraryPanel } from '@/components/objectives/ObjectiveLibraryPanel'
import { BookPage, type BookPageData, BOOK_W, BOOK_H, SOURCE_TAG_META, COVER_PALETTES } from '@/components/book/BookPage'
import type { Section, Paragraph, SourceTag, BookCover } from '@/types'

export default function BookWorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const bookId = params.id as string

  const {
    fetchBook, fetchObjectives, currentBook, chapters, sections,
    objectives, libraries, coverage, sourceStats, selectedObjectiveIds, setSelectedObjectiveIds, generateToc,
  } = useBookStore()
  const {
    paragraphs, illustrations, questions, streamingContent, isStreaming,
    highlightObjectiveId, highlightParagraphId, setHighlightObjective, setHighlightParagraph,
    fetchSectionDetail, generateSection, generateQuestions, startBatch, stopBatch, batchAbort,
  } = useEditorStore()

  // 工作流视图：outline = 大纲调整环节（正文前的确认节点）；reader = 正文创作
  const [view, setView] = useState<'outline' | 'reader' | null>(null)
  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [flipDir, setFlipDir] = useState<'next' | 'prev'>('next')
  const [scale, setScale] = useState(0.8)
  const [objPanelOpen, setObjPanelOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [tocGenerating, setTocGenerating] = useState(false)
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<SourceTag | 'all'>('all')
  const [quotedText, setQuotedText] = useState<string | null>(null)
  const [selectionBtn, setSelectionBtn] = useState<{ x: number; y: number; text: string } | null>(null)
  const [cover, setCover] = useState<BookCover | null>(null)
  const [coverEditorOpen, setCoverEditorOpen] = useState(false)
  const bookAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchBook(bookId)
    fetchObjectives()
    fetch(`/api/cover?book_id=${bookId}`).then(r => r.json()).then(setCover).catch(() => {})
  }, [bookId, fetchBook, fetchObjectives])

  const orientation = (currentBook?.orientation ?? 'portrait') as 'portrait' | 'landscape'
  const isAdaptation = currentBook?.source === 'adaptation'
  const inDesignStage = !!currentBook && chapters.length === 0

  // 初始视图判定：有正文 → 直接进正文；只有大纲 → 先进大纲调整环节
  useEffect(() => {
    if (view === null && chapters.length > 0) {
      setView(sections.some(s => s.status === 'completed') ? 'reader' : 'outline')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters.length, sections.length])

  // ── 版面缩放：由窗口与开启的面板动态计算 ──
  useLayoutEffect(() => {
    function compute() {
      const bw = BOOK_W[orientation]
      const bh = BOOK_H[orientation]
      const left = 264 + (objPanelOpen && inDesignStage ? 288 : 0)
      const right = chatOpen ? 320 : 0
      const availW = window.innerWidth - left - right - 56
      const availH = window.innerHeight - 44 - 88  // 顶栏 + 悬浮翻页条余量
      setScale(Math.max(Math.min(availW / bw, availH / bh, 1.05), 0.4))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [orientation, objPanelOpen, chatOpen, inDesignStage])

  // ── 页面组装（页码动态重算：结构一变页码全部自动更新）──
  const pages: BookPageData[] = []
  const pageOfSection: Record<string, number> = {}
  const pageOfChapter: Record<string, number> = {}
  {
    const byChapter = sections.reduce<Record<string, Section[]>>((a, s) => {
      ;(a[s.chapter_id] ??= []).push(s); return a
    }, {})
    if (currentBook) pages.push({ type: 'cover', book: currentBook, cover })
    pages.push({ type: 'toc', chapters, sections, pageOfSection, pageOfChapter })
    chapters.forEach((ch, ci) => {
      pageOfChapter[ch.id] = pages.length
      pages.push({ type: 'chapter', chapter: ch, chapterNo: ci + 1, pageNum: pages.length })
      for (const sec of byChapter[ch.id] ?? []) {
        pageOfSection[sec.id] = pages.length
        pages.push({ type: 'section', section: sec, chapter: ch, pageNum: pages.length, totalPages: 0 })
      }
    })
    // 索引页：学习目标 → 覆盖页码
    if (chapters.length) {
      const entries = objectives
        .map(o => ({
          objective: o,
          pages: sections.filter(s => s.objective_ids.includes(o.id)).map(s => pageOfSection[s.id]).filter(p => p !== undefined),
        }))
        .filter(e => e.pages.length > 0)
      pages.push({ type: 'index', entries })
    }
    const total = pages.length
    for (const p of pages) if (p.type === 'section') p.totalPages = total
  }
  const safePageIdx = Math.min(currentPageIdx, pages.length - 1)
  const currentPage = pages[safePageIdx]
  const currentSection = currentPage?.type === 'section' ? currentPage.section : null

  // 翻到正文页时载入段落/插图/题目
  const currentSectionId = currentSection?.id
  useEffect(() => {
    if (currentSectionId) fetchSectionDetail(currentSectionId)
  }, [currentSectionId, fetchSectionDetail])

  // 立即翻页（动画由 key 变化触发入场效果，不延迟状态切换）
  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= pages.length || idx === safePageIdx) return
    setFlipDir(idx > safePageIdx ? 'next' : 'prev')
    setCurrentPageIdx(idx)
  }, [pages.length, safePageIdx])

  // 键盘翻页 ← →
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') goTo(safePageIdx + 1)
      if (e.key === 'ArrowLeft') goTo(safePageIdx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, safePageIdx])

  // 空白处按住拖拽平移画布（目标库展开、空间不足时书本可拖动查看）
  const panState = useRef<{ startX: number; startY: number; sl: number; st: number } | null>(null)
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    const el = bookAreaRef.current
    if (!el) return
    // 只在点击画布空白处（非书页内容/按钮）时启动平移
    if ((e.target as HTMLElement).closest('[data-book-page],button')) return
    panState.current = { startX: e.clientX, startY: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
    el.style.cursor = 'grabbing'
  }, [])
  const handlePanMove = useCallback((e: React.MouseEvent) => {
    const el = bookAreaRef.current
    if (!el || !panState.current) return
    el.scrollLeft = panState.current.sl - (e.clientX - panState.current.startX)
    el.scrollTop = panState.current.st - (e.clientY - panState.current.startY)
  }, [])
  const handlePanEnd = useCallback(() => {
    panState.current = null
    if (bookAreaRef.current) bookAreaRef.current.style.cursor = ''
  }, [])

  // ── 目录生成（流式，看板逐章长出）→ 完成后进入大纲调整环节 ──
  const handleGenerateToc = useCallback(async () => {
    setTocGenerating(true)
    await generateToc(bookId, selectedObjectiveIds)
    await fetchBook(bookId)
    setTocGenerating(false)
    setView('outline')
  }, [bookId, selectedObjectiveIds, generateToc, fetchBook])

  // ── 单节生成：正文 + 按已确认脉络执行练/图颗粒 ──
  const handleGenerateSection = useCallback(async (sectionId: string, signal?: AbortSignal) => {
    const idx = pageOfSection[sectionId]
    if (idx !== undefined) setCurrentPageIdx(idx)
    setGeneratingSectionId(sectionId)
    try {
      const ok = await generateSection(sectionId, 'generate', { signal })
      if (ok) await runElementBlocks(sectionId)
      return ok
    } finally {
      setGeneratingSectionId(null)
      await fetchBook(bookId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateSection, fetchBook, bookId, JSON.stringify(Object.keys(pageOfSection))])

  // 练/图颗粒执行：exercise → 按目标出题；figure → 为图占位段配 AI 插图
  const runElementBlocks = useCallback(async (sectionId: string) => {
    try {
      const detail = await (await fetch(`/api/sections/${sectionId}`)).json()
      const sec: Section = detail.section
      if (sec.elements.exercise) {
        await fetch('/api/ai/questions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionId, count: 4 }),
        })
      }
      if (sec.elements.illustration) {
        const paras: Paragraph[] = detail.paragraphs ?? []
        // 优先挂到 [图：…] 占位段，否则首段
        const target = paras.find(p => p.content.includes('[图')) ?? paras[0]
        if (target) {
          await fetch('/api/ai/illustration', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionId, sectionTitle: sec.title, paragraphId: target.id, paragraphText: target.content.slice(0, 600) }),
          })
        }
      }
      await fetchSectionDetail(sectionId)
    } catch { /* 颗粒执行失败不阻断 */ }
  }, [fetchSectionDetail])

  // ── 批量填充：逐节点亮 + 中断 + 断点续生成 + 按功能元素配置自动出题/配图 ──
  const handleBatchGenerate = useCallback(async () => {
    const controller = startBatch()
    const pending = sections.filter(s => s.status === 'pending' || s.status === 'error')
    for (const sec of pending) {
      if (controller.signal.aborted) break
      // handleGenerateSection 内部已按脉络执行练/图颗粒
      const ok = await handleGenerateSection(sec.id, controller.signal)
      if (!ok) break
    }
    stopBatch()
  }, [sections, startBatch, stopBatch, handleGenerateSection])

  // ── 出题（小节整体 / 选中段落定向）──
  const handleGenerateQuestions = useCallback(async (sectionId: string, paragraphText?: string) => {
    setGeneratingQuestions(true)
    try {
      await generateQuestions(sectionId, { paragraphText, append: !!paragraphText })
    } finally {
      setGeneratingQuestions(false)
    }
  }, [generateQuestions])

  // ── 双向高亮：点段落 → 本节目标检视条上亮起对应目标 ──
  const handleParagraphClick = useCallback((p: Paragraph) => {
    setHighlightParagraph(highlightParagraphId === p.id ? null : p.id)
  }, [highlightParagraphId, setHighlightParagraph])

  const reverseHighlightIds = highlightParagraphId
    ? (paragraphs.find(p => p.id === highlightParagraphId)?.objective_ids ?? [])
    : []

  // ── 选区引用到对话 ──
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (text && text.length >= 8 && sel && sel.rangeCount) {
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      setSelectionBtn({ x: rect.left + rect.width / 2, y: rect.top - 8, text })
    } else {
      setSelectionBtn(null)
    }
  }, [])

  // ── 主编改动后：刷新数据并夹紧页码 ──
  const handleStructureChanged = useCallback(async () => {
    await fetchBook(bookId)
    setCurrentPageIdx(i => Math.max(0, Math.min(i, 0x7fffffff)))
  }, [fetchBook, bookId])

  // ── 插图操作 ──
  const refreshSection = useCallback(() => {
    if (currentSectionId) fetchSectionDetail(currentSectionId)
  }, [currentSectionId, fetchSectionDetail])

  const handleDeleteIllustration = useCallback(async (id: string) => {
    await fetch('/api/illustrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    refreshSection()
  }, [refreshSection])

  // 拖拽调整插图位置：拖到目标段落即挂载到该段之下
  const handleMoveIllustration = useCallback(async (illusId: string, paragraphId: string) => {
    await fetch('/api/illustrations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: illusId, paragraph_id: paragraphId }),
    })
    refreshSection()
  }, [refreshSection])

  const handleRegenerateIllustration = useCallback(async (illus: { id: string; paragraph_id: string | null; caption: string }) => {
    if (!currentSection) return
    const para = paragraphs.find(p => p.id === illus.paragraph_id)
    await fetch('/api/ai/illustration', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: currentSection.id,
        sectionTitle: currentSection.title,
        paragraphId: illus.paragraph_id,
        paragraphText: para?.content.slice(0, 600) ?? illus.caption,
      }),
    })
    await fetch('/api/illustrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: illus.id }) })
    refreshSection()
  }, [currentSection, paragraphs, refreshSection])

  const handleSaveContent = useCallback(async (sectionId: string, content: string) => {
    await fetch(`/api/sections/${sectionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    await fetchBook(bookId)
    await fetchSectionDetail(sectionId)
  }, [fetchBook, bookId, fetchSectionDetail])

  if (!currentBook) {
    return <div className="h-screen flex items-center justify-center bg-zinc-100"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
  }

  return (
    <div className="h-screen flex flex-col bg-[#e9e6e1] overflow-hidden">
      {/* ── 顶栏 ── */}
      <header className="shrink-0 h-11 border-b border-zinc-300/60 bg-white/95 backdrop-blur px-3 flex items-center gap-2.5 z-30">
        <button onClick={() => router.push('/')} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1"><ArrowLeft className="w-4 h-4" /></button>
        <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
        <span className="font-semibold text-zinc-800 text-[13px] truncate max-w-[260px]">{currentBook.title}</span>
        <span className="text-[10.5px] text-zinc-400 shrink-0">{currentBook.audience_grade} · {currentBook.style === 'academic' ? '学术' : currentBook.style === 'casual' ? '轻松' : '深入浅出'} · {orientation === 'portrait' ? 'A4竖版' : '16:9横版'}</span>
        {isAdaptation && <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-px rounded-full shrink-0">二创改编</span>}

        {/* 工作流阶段切换：大纲 → 正文 */}
        {!inDesignStage && (
          <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg p-0.5 ml-2">
            <button onClick={() => setView('outline')}
              className={`px-3 py-1 rounded-md text-[11.5px] font-medium transition-colors ${view === 'outline' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
              ① 教学大纲
            </button>
            <button onClick={() => setView('reader')}
              className={`px-3 py-1 rounded-md text-[11.5px] font-medium transition-colors ${view === 'reader' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
              ② 正文创作
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* sourceTag 图例 + 筛选 + 全书来源占比（线路B 忠实度审计）*/}
        {isAdaptation && !inDesignStage && (() => {
          const total = (Object.keys(SOURCE_TAG_META) as SourceTag[]).reduce((n, t) => n + (sourceStats[t] ?? 0), 0)
          const pct = (n: number) => total ? Math.round((n / total) * 100) : 0
          return (
            <div className="flex items-center gap-1 mr-1" title={total ? `全书共 ${total} 段，按来源占比` : '生成正文后显示来源占比'}>
              <button onClick={() => setSourceFilter('all')}
                className={`text-[10px] px-2 py-1 rounded-md transition-colors ${sourceFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>全部</button>
              {(Object.keys(SOURCE_TAG_META) as SourceTag[]).map(tag => {
                const n = sourceStats[tag] ?? 0
                return (
                  <button key={tag} onClick={() => setSourceFilter(sourceFilter === tag ? 'all' : tag)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors ${sourceFilter === tag ? SOURCE_TAG_META[tag].chip + ' ring-1 ring-current' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                    <span className={`w-2 h-2 rounded-full ${SOURCE_TAG_META[tag].bar}`} />
                    {SOURCE_TAG_META[tag].label}
                    {total > 0 && <span className="tabular-nums font-medium opacity-70">{pct(n)}%</span>}
                  </button>
                )
              })}
            </div>
          )
        })()}

        {!inDesignStage && (
          <button onClick={() => setCoverEditorOpen(true)}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors">
            <Palette className="w-3.5 h-3.5" />封面
          </button>
        )}
        {/* 目标库面板只在目录设计阶段出现——正文阶段目标以"本节目标检视条"呈现 */}
        {inDesignStage && (
          <button onClick={() => setObjPanelOpen(!objPanelOpen)}
            className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors ${objPanelOpen ? 'bg-amber-100 text-amber-700' : 'text-zinc-500 hover:bg-zinc-100'}`}>
            <Target className="w-3.5 h-3.5" />目标库
          </button>
        )}
        <button onClick={() => setChatOpen(!chatOpen)}
          className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors ${chatOpen ? 'bg-purple-100 text-purple-700' : 'text-zinc-500 hover:bg-zinc-100'}`}>
          <Wand2 className="w-3.5 h-3.5" />主编
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── 左：大纲看板（正文创作阶段显示；大纲阶段主视图已含全部信息）── */}
        <aside className={`w-64 shrink-0 bg-white border-r border-zinc-200 overflow-hidden ${view === 'outline' && !inDesignStage ? 'hidden' : ''}`}>
          {inDesignStage && !tocGenerating ? (
            <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-3">
              <PanelLeft className="w-8 h-8 text-zinc-200" />
              <p className="text-[12px] text-zinc-400 leading-relaxed">勾选学习目标并生成目录后，<br />大纲看板将在这里实时长出</p>
            </div>
          ) : (
            <TOCBoard
              chapters={chapters} sections={sections} objectives={objectives}
              currentPageIndex={safePageIdx}
              pageOfSection={pageOfSection} pageOfChapter={pageOfChapter}
              onSelectPage={goTo}
              onGenerateSection={id => handleGenerateSection(id)}
              onBatchGenerate={handleBatchGenerate}
              onStopBatch={stopBatch}
              isBatchRunning={!!batchAbort}
              generatingSectionId={generatingSectionId}
              onChanged={handleStructureChanged}
            />
          )}
        </aside>

        {/* ── 目标库侧栏（仅目录设计阶段：勾选全书要覆盖的目标）── */}
        {objPanelOpen && inDesignStage && (
          <aside className="w-72 shrink-0 bg-white border-r border-zinc-200 overflow-hidden flex flex-col">
            <div className="shrink-0 px-3 py-2.5 border-b border-zinc-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-600 flex items-center gap-1"><Target className="w-3.5 h-3.5 text-amber-500" />学习目标库</span>
              <button onClick={() => setObjPanelOpen(false)} className="text-zinc-300 hover:text-zinc-500"><PanelLeftClose className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ObjectiveLibraryPanel
                libraries={libraries} objectives={objectives}
                mode={inDesignStage ? 'select' : 'trace'}
                selectedIds={selectedObjectiveIds}
                onToggle={id => setSelectedObjectiveIds(
                  selectedObjectiveIds.includes(id)
                    ? selectedObjectiveIds.filter(x => x !== id)
                    : [...selectedObjectiveIds, id])}
                onSelectAll={setSelectedObjectiveIds}
                coverage={coverage}
                highlightObjectiveId={highlightObjectiveId}
                reverseHighlightIds={reverseHighlightIds}
                onTrace={setHighlightObjective}
              />
            </div>
          </aside>
        )}

        {/* ── 中：书页（可滚动画布 + 悬浮翻页条）── */}
        <main className="flex-1 relative overflow-hidden">
          <div ref={bookAreaRef}
            className="absolute inset-0 overflow-auto"
            onMouseUp={() => { handlePanEnd(); handleMouseUp() }}
            onMouseDown={handlePanStart}
            onMouseMove={handlePanMove}
            onMouseLeave={handlePanEnd}>
            {inDesignStage ? (
              <div className="min-h-full w-full flex">
                <div className="m-auto py-8 px-6">
                  <DesignStage
                    tocGenerating={tocGenerating}
                    selectedCount={selectedObjectiveIds.length}
                    chaptersArrived={chapters.length}
                    objPanelOpen={objPanelOpen}
                    onOpenPanel={() => setObjPanelOpen(true)}
                    onGenerate={handleGenerateToc}
                  />
                </div>
              </div>
            ) : view === 'outline' ? (
              <div className="min-h-full w-full" data-book-page>
                <OutlineView
                  chapters={chapters} sections={sections} objectives={objectives}
                  onChanged={handleStructureChanged}
                  onConfirm={() => setView('reader')}
                  targetWordCount={currentBook?.target_word_count}
                />
              </div>
            ) : pages.length <= 1 ? (
              <div className="min-h-full flex"><p className="m-auto text-sm text-zinc-400">暂无内容</p></div>
            ) : (
              /* m-auto 安全居中：内容超出视口时不裁顶、可滚动 */
              <div className="min-h-full min-w-fit w-full flex px-6 pt-5 pb-20">
                <div className="m-auto" data-book-page
                  style={{
                    width: BOOK_W[orientation] * scale,
                    height: BOOK_H[orientation] * scale,
                    perspective: 1400,
                  }}>
                  <div key={safePageIdx}
                    style={{
                      transformStyle: 'preserve-3d',
                      animation: `${flipDir === 'next' ? 'page-in-next' : 'page-in-prev'} 280ms ease-out`,
                    }}>
                    <BookPage
                      page={currentPage}
                      orientation={orientation}
                      scale={scale}
                      paragraphs={currentSection ? paragraphs : []}
                      illustrations={currentSection ? illustrations : []}
                      questions={currentSection ? questions : []}
                      objectives={objectives}
                      showSourceTags={isAdaptation}
                      sourceFilter={sourceFilter}
                      highlightObjectiveId={highlightObjectiveId}
                      highlightParagraphId={highlightParagraphId}
                      reverseHighlightIds={reverseHighlightIds}
                      onTraceObjective={setHighlightObjective}
                      streamingContent={generatingSectionId === currentSection?.id ? streamingContent : undefined}
                      isStreaming={isStreaming && generatingSectionId === currentSection?.id}
                      isGeneratingQuestions={generatingQuestions}
                      onSelectPage={goTo}
                      onParagraphClick={handleParagraphClick}
                      onGenerateSection={id => handleGenerateSection(id)}
                      onSaveContent={handleSaveContent}
                      onGenerateQuestions={handleGenerateQuestions}
                      onInsertIllustration={refreshSection}
                      onDeleteIllustration={handleDeleteIllustration}
                      onRegenerateIllustration={handleRegenerateIllustration}
                      onMoveIllustration={handleMoveIllustration}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 悬浮翻页条：固定在看板底部，不随内容滚动，永远可点 */}
          {!inDesignStage && view === 'reader' && pages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white/95 backdrop-blur border border-zinc-200 rounded-full shadow-lg px-3 py-1.5">
              <button onClick={() => goTo(safePageIdx - 1)} disabled={safePageIdx === 0}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 disabled:opacity-25 transition-colors">
                <ChevronLeft className="w-4 h-4 text-zinc-600" />
              </button>
              <span className="text-[11.5px] text-zinc-500 tabular-nums min-w-[68px] text-center select-none">第 {safePageIdx + 1} / {pages.length} 页</span>
              <button onClick={() => goTo(safePageIdx + 1)} disabled={safePageIdx >= pages.length - 1}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 disabled:opacity-25 transition-colors">
                <ChevronRight className="w-4 h-4 text-zinc-600" />
              </button>
            </div>
          )}

          {/* 选区引用浮动按钮 */}
          {selectionBtn && (
            <button
              className="fixed z-50 flex items-center gap-1 -translate-x-1/2 -translate-y-full bg-zinc-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-xl hover:bg-zinc-700 transition-colors"
              style={{ left: selectionBtn.x, top: selectionBtn.y }}
              onClick={() => { setQuotedText(selectionBtn.text); setChatOpen(true); setSelectionBtn(null); window.getSelection()?.removeAllRanges() }}>
              <Quote className="w-3 h-3" />引用到对话
            </button>
          )}
        </main>

        {/* ── 右：AI 主编 ── */}
        {chatOpen && (
          <aside className="w-80 shrink-0 bg-white border-l border-zinc-200 overflow-hidden">
            <ChatPanel bookId={bookId}
              quotedText={quotedText}
              onClearQuote={() => setQuotedText(null)}
              onStructureChanged={handleStructureChanged} />
          </aside>
        )}

        {/* ── 封面设计模块 ── */}
        {coverEditorOpen && currentBook && (
          <CoverEditor bookId={bookId} initial={cover}
            onClose={() => setCoverEditorOpen(false)}
            onSaved={c => { setCover(c); setCoverEditorOpen(false); setCurrentPageIdx(0) }} />
        )}
      </div>
    </div>
  )
}

// ─── 封面设计模块 ─────────────────────────────────────────────────────────────
function CoverEditor({ bookId, initial, onClose, onSaved }: {
  bookId: string
  initial: BookCover | null
  onClose: () => void
  onSaved: (c: BookCover) => void
}) {
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? '')
  const [authorLine, setAuthorLine] = useState(initial?.author_line ?? '')
  const [palette, setPalette] = useState(initial?.palette ?? 'indigo')
  const [generateArt, setGenerateArt] = useState(!initial?.svg_content)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch('/api/cover', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId, subtitle, author_line: authorLine, palette, generate_art: generateArt, svg_content: generateArt ? undefined : initial?.svg_content }),
    })
    setSaving(false)
    if (res.ok) onSaved(await res.json())
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-zinc-800 flex items-center gap-2"><Palette className="w-4 h-4 text-rose-500" />封面设计</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">副标题</label>
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
            placeholder="例：从直觉到严谨的思维之旅"
            className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">署名行</label>
          <input value={authorLine} onChange={e => setAuthorLine(e.target.value)}
            placeholder="例：XX 老师 编著"
            className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">配色方案</label>
          <div className="flex gap-2">
            {Object.keys(COVER_PALETTES).map(p => (
              <button key={p} onClick={() => setPalette(p)}
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${COVER_PALETTES[p].bg} transition-all ${palette === p ? 'ring-2 ring-offset-2 ring-zinc-400 scale-105' : 'opacity-70 hover:opacity-100'}`} />
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-zinc-600 cursor-pointer">
          <input type="checkbox" checked={generateArt} onChange={e => setGenerateArt(e.target.checked)} className="rounded" />
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          AI 生成封面主视觉插画（SVG 矢量）
        </label>
        <button onClick={save} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-50 text-sm font-medium transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? '生成中…' : '保存并查看封面'}
        </button>
      </div>
    </div>
  )
}

// ─── 目录设计阶段（线路 A 第一屏）───────────────────────────────────────────────
function DesignStage({ tocGenerating, selectedCount, chaptersArrived, objPanelOpen, onOpenPanel, onGenerate }: {
  tocGenerating: boolean
  selectedCount: number
  chaptersArrived: number
  objPanelOpen: boolean
  onOpenPanel: () => void
  onGenerate: () => void
}) {
  if (tocGenerating) {
    return (
      <div className="text-center space-y-4 max-w-sm">
        <div className="flex justify-center gap-1.5">
          {[0, 150, 300].map(d => <span key={d} className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
        </div>
        <p className="text-[14px] font-medium text-zinc-700">AI 正在设计目录…</p>
        <p className="text-[12px] text-zinc-400">已生成 {chaptersArrived} 章——左侧看板实时更新，每章带学习目标关联</p>
      </div>
    )
  }
  return (
    <div className="text-center space-y-5 max-w-md px-6">
      <Sparkles className="w-10 h-10 text-blue-500 mx-auto" />
      <div>
        <h2 className="text-[17px] font-bold text-zinc-800 mb-2">目录设计</h2>
        <p className="text-[13px] text-zinc-500 leading-relaxed">
          第一步：从左侧<button onClick={onOpenPanel} className="text-amber-600 font-medium hover:underline mx-0.5">学习目标库</button>勾选这本书要覆盖的目标；<br />
          第二步：AI 依据目标 + 课本定位流式生成目录，每章自动关联目标。
        </p>
      </div>
      {!objPanelOpen && selectedCount === 0 && (
        <button onClick={onOpenPanel}
          className="flex items-center gap-1.5 mx-auto text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 hover:bg-amber-100 transition-colors">
          <Target className="w-4 h-4" />打开目标库勾选
        </button>
      )}
      <div className="flex flex-col items-center gap-2">
        <button onClick={onGenerate}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-medium text-[14px] transition-colors shadow-lg shadow-blue-200">
          <Sparkles className="w-4 h-4" />
          生成目录{selectedCount > 0 ? `（已选 ${selectedCount} 个目标）` : ''}
        </button>
        {selectedCount === 0 && <p className="text-[11px] text-zinc-400">未勾选目标也可生成，AI 将按主题自行组织</p>}
      </div>
    </div>
  )
}
