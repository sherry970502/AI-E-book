'use client'
import { useState, useEffect, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, ArrowRight, ArrowLeft, Loader2, Layers, Wand2, CheckCircle2, FastForward } from 'lucide-react'
import { useBookStore } from '@/store/bookStore'
import { ImportUploader, type ParseMeta } from '@/components/route-b/ImportUploader'
import { AlignmentMatrix } from '@/components/route-b/AlignmentMatrix'
import { ObjectiveLibraryPanel } from '@/components/objectives/ObjectiveLibraryPanel'
import { OutlineView } from '@/components/book/OutlineView'
import { ChatPanel } from '@/components/book/ChatPanel'
import type { KnowledgeUnit } from '@/types'

/**
 * 二创流程（逻辑：AI 先解构，用户在既有物上决定改什么，目标增补放最后）：
 * ① 导入解析 → ② 原书纲要（AI 拆出的结构+目标直接呈现，可编辑/可让主编改）
 * → ③ 改编设置（单元标记/受众迁移/教学法/自由意图）→ ④ 目标增补（可选）→ ⑤ 方案卡
 */
type Step = 'upload' | 'outline' | 'intent' | 'objectives' | 'plan'

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: '① 导入解析' },
  { key: 'outline', label: '② 原书纲要' },
  { key: 'intent', label: '③ 改编设置' },
  { key: 'objectives', label: '④ 目标增补' },
  { key: 'plan', label: '⑤ 改编方案' },
]

const INTENT_OPTIONS = [
  { value: 'keep', label: '保留原意改写', cls: 'border-sky-400 bg-sky-50 text-sky-700' },
  { value: 'rewrite', label: '深度重写', cls: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { value: 'delete', label: '删除', cls: 'border-red-300 bg-red-50 text-red-600' },
]

const PEDAGOGY_OPTIONS = ['案例驱动', '问题导向', '项目式', '讲练结合']

function ImportPageContent() {
  const searchParams = useSearchParams()
  const bookId = searchParams.get('bookId') ?? ''
  const router = useRouter()

  const {
    fetchBook, fetchObjectives, currentBook, chapters, sections, knowledgeUnits, skeleton,
    objectives, libraries, alignments, alignObjectives,
    selectedObjectiveIds, setSelectedObjectiveIds,
  } = useBookStore()

  const [step, setStep] = useState<Step>('upload')
  const [parseMeta, setParseMeta] = useState<ParseMeta | null>(null)
  const [extractedCount, setExtractedCount] = useState(0)
  const [materializing, setMaterializing] = useState(false)
  const [aligning, setAligning] = useState(false)
  const [finishing, setFinishing] = useState(false)
  // 改编设置状态
  const [unitIntents, setUnitIntents] = useState<Record<string, string>>({})
  const [audienceNote, setAudienceNote] = useState('')
  const [pedagogy, setPedagogy] = useState('')
  const [freeIntent, setFreeIntent] = useState('')
  const [structuredIntent, setStructuredIntent] = useState<string[]>([])
  const [parsingIntent, setParsingIntent] = useState(false)

  useEffect(() => { if (bookId) { fetchBook(bookId); fetchObjectives() } }, [bookId, fetchBook, fetchObjectives])
  useEffect(() => {
    if (knowledgeUnits.length && !Object.keys(unitIntents).length) {
      setUnitIntents(Object.fromEntries(knowledgeUnits.map(u => [u.id, u.intent ?? 'keep'])))
      // 回访：已有纲要直接到纲要步
      if (step === 'upload' && chapters.length > 0) setStep('outline')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeUnits.length, chapters.length])

  // ── ①→②：物化原书纲要（骨架直接铺开，不调 AI）──
  const enterOutline = useCallback(async () => {
    setMaterializing(true)
    await fetch('/api/skeleton/materialize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId }),
    })
    await fetchBook(bookId)
    setMaterializing(false)
    setStep('outline')
  }, [bookId, fetchBook])

  const toggleObj = (id: string) =>
    setSelectedObjectiveIds(selectedObjectiveIds.includes(id)
      ? selectedObjectiveIds.filter(x => x !== id)
      : [...selectedObjectiveIds, id])

  async function handleAlign() {
    if (!skeleton) return
    setAligning(true)
    await alignObjectives(skeleton.id, selectedObjectiveIds)
    setAligning(false)
  }

  const setIntent = useCallback(async (unitId: string, intent: string) => {
    setUnitIntents(prev => ({ ...prev, [unitId]: intent }))
    await fetch(`/api/knowledge-units/${unitId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent, objectiveIds: knowledgeUnits.find(u => u.id === unitId)?.objective_ids ?? [] }),
    })
  }, [knowledgeUnits])

  async function parseFreeIntent() {
    if (!freeIntent.trim()) return
    setParsingIntent(true)
    const res = await fetch('/api/adaptation-plan', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId, audience_note: audienceNote, pedagogy, free_intent: freeIntent, parse_intent: true }),
    })
    const plan = await res.json()
    setStructuredIntent(plan.structured_intent ?? [])
    setParsingIntent(false)
  }

  // ── ③→④：把单元的删除/恢复处置同步到物化小节（删除的单元不再进新书目录）──
  const [reconciling, setReconciling] = useState(false)
  async function reconcileAndNext() {
    setReconciling(true)
    await fetch('/api/skeleton/reconcile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId }),
    })
    await fetchBook(bookId)
    setReconciling(false)
    setStep('objectives')
  }

  // ── 完成：保存方案 → 目标增补落点 → 进工作台（纲要即目录，不再让 AI 重新生成）──
  async function confirmAndFinish() {
    setFinishing(true)
    await fetch('/api/adaptation-plan', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId, audience_note: audienceNote, pedagogy, free_intent: freeIntent, structured_intent: structuredIntent, confirmed: true }),
    })
    if (selectedObjectiveIds.length) {
      await fetch('/api/skeleton/augment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, objectiveIds: selectedObjectiveIds }),
      })
    }
    router.push(`/books/${bookId}`)
  }

  // 方案卡统计
  const intentStats = { keep: 0, rewrite: 0, delete: 0 }
  for (const u of knowledgeUnits) {
    const it = (unitIntents[u.id] ?? 'keep') as keyof typeof intentStats
    if (it in intentStats) intentStats[it]++
  }
  const coveredIds = new Set(sections.flatMap(s => s.objective_ids))
  const addedObjectives = selectedObjectiveIds.filter(id => !coveredIds.has(id))
  const affectedChapters = [...new Set(knowledgeUnits.filter(u => (unitIntents[u.id] ?? 'keep') !== 'keep').map(u => u.chapter_title))]

  const byChapter = knowledgeUnits.reduce<Record<string, KnowledgeUnit[]>>((a, u) => {
    ;(a[u.chapter_title] ??= []).push(u); return a
  }, {})

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-3.5 flex items-center gap-3 sticky top-0 z-20">
        <BookOpen className="w-5 h-5 text-blue-600" />
        <span className="text-sm text-zinc-500">线路 B · 现有课本二创</span>
        <span className="text-zinc-300">/</span>
        <span className="text-sm font-medium text-zinc-800">{currentBook?.title ?? '加载中…'}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {STEPS.map(({ key, label }, i) => {
            const idx = STEPS.findIndex(s => s.key === step)
            return (
              <span key={key} className={`text-[12px] whitespace-nowrap ${step === key ? 'font-bold text-blue-600' : i < idx ? 'text-green-600' : 'text-zinc-300'}`}>
                {i < idx ? '✓' : ''}{label}
              </span>
            )
          })}
        </div>
      </header>

      <main className={step === 'outline' ? '' : 'max-w-5xl mx-auto px-6 py-8'}>
        {/* ── ① 导入解析 ── */}
        {step === 'upload' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100">
                <h2 className="font-semibold text-zinc-800">上传原版教材</h2>
                <p className="text-[12.5px] text-zinc-500 mt-0.5">AI 将解构出原书的纲要与学习目标，你在这个基础上决定怎么改——二创改的是骨架，不是文本。</p>
              </div>
              <ImportUploader bookId={bookId} onParsed={(_, __, meta, extractedIds) => {
                setParseMeta(meta)
                setExtractedCount(extractedIds.length)
                if (extractedIds.length) setSelectedObjectiveIds(extractedIds)
                fetchBook(bookId)
                fetchObjectives()
              }} />
            </div>
            {parseMeta && (
              <>
                <FourLayerCard meta={parseMeta} unitCount={knowledgeUnits.length} extractedCount={extractedCount} />
                <div className="flex justify-end">
                  <button onClick={enterOutline} disabled={materializing}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                    {materializing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    查看原书纲要 <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ② 原书纲要：AI 解构结果 + 主编协同调整 ── */}
        {step === 'outline' && (
          <div className="flex h-[calc(100vh-57px)]">
            <div className="flex-1 overflow-hidden bg-zinc-50">
              <OutlineView
                chapters={chapters} sections={sections} objectives={objectives}
                onChanged={() => fetchBook(bookId)}
                onConfirm={() => setStep('intent')}
                heading="原书纲要（AI 解构）"
                description={<>这是 AI 从原书拆解出的章节结构、教学要点与学习目标——<b>在既有物上做决定</b>。<br />
                  可直接点击编辑任何内容，或告诉右侧主编改什么（如「把第二章拆成两章」「删掉 3.2」）。</>}
                confirmLabel="纲要调整好了，进入改编设置"
                secondaryAction={
                  <button onClick={() => setStep('plan')}
                    className="flex items-center gap-1 text-[11.5px] text-zinc-500 hover:text-blue-600 transition-colors">
                    <FastForward className="w-3.5 h-3.5" />纲要没问题，直接改编正文
                  </button>
                }
              />
            </div>
            <aside className="w-80 shrink-0 bg-white border-l border-zinc-200 overflow-hidden">
              <ChatPanel bookId={bookId} onStructureChanged={() => fetchBook(bookId)} />
            </aside>
          </div>
        )}

        {/* ── ③ 改编设置 ── */}
        {step === 'intent' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6">
              <h2 className="font-semibold text-zinc-800 mb-1">单元级操作</h2>
              <p className="text-[12.5px] text-zinc-500 mb-4">对原书每个知识单元标注处置方式，决定改编时的忠实度（影响正文的溯源标记）。</p>
              <div className="space-y-4">
                {Object.entries(byChapter).map(([ct, us]) => (
                  <div key={ct}>
                    <p className="text-[12.5px] font-bold text-zinc-700 mb-2">{ct}</p>
                    <div className="space-y-1.5">
                      {us.map(u => {
                        const cur = unitIntents[u.id] ?? 'keep'
                        return (
                          <div key={u.id} className={`flex items-center gap-3 border rounded-xl px-3.5 py-2.5 transition-colors ${cur === 'delete' ? 'border-red-100 bg-red-50/40 opacity-60' : 'border-zinc-200'}`}>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[12.5px] font-medium text-zinc-700 ${cur === 'delete' ? 'line-through' : ''}`}>{u.core_concept}</p>
                              {u.definition && <p className="text-[11px] text-zinc-400 line-clamp-1">{u.definition}</p>}
                            </div>
                            <div className="shrink-0 flex gap-1">
                              {INTENT_OPTIONS.map(opt => (
                                <button key={opt.value} onClick={() => setIntent(u.id, opt.value)}
                                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${cur === opt.value ? opt.cls + ' font-medium' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'}`}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-zinc-800 mb-1">受众迁移声明</h2>
                <input value={audienceNote} onChange={e => setAudienceNote(e.target.value)}
                  placeholder="例：原书面向大学生，改编为面向高中生——全书深度、语言与例子相应调整"
                  className="w-full mt-2 border border-zinc-200 rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <h2 className="font-semibold text-zinc-800 mb-2">教学法偏好<span className="ml-2 text-[11px] font-normal text-zinc-400">作用于全书生成策略</span></h2>
                <div className="flex gap-2">
                  {PEDAGOGY_OPTIONS.map(p => (
                    <button key={p} onClick={() => setPedagogy(pedagogy === p ? '' : p)}
                      className={`text-[12.5px] px-3.5 py-1.5 rounded-xl border transition-all ${pedagogy === p ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="font-semibold text-zinc-800 mb-1">自由意图<span className="ml-2 text-[11px] font-normal text-zinc-400">描述"我具体想怎么教"，AI 转为结构化指令回显</span></h2>
                <textarea value={freeIntent} onChange={e => setFreeIntent(e.target.value)} rows={3}
                  placeholder="例：我希望每章都从一个真实问题开始；概念讲解多用图示；把第二章的证明改成探究式引导。"
                  className="w-full mt-2 border border-zinc-200 rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
                <button onClick={parseFreeIntent} disabled={parsingIntent || !freeIntent.trim()}
                  className="mt-2 flex items-center gap-1.5 text-[12px] text-purple-600 border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-50 disabled:opacity-40 transition-colors">
                  {parsingIntent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  解析为结构化指令
                </button>
                {structuredIntent.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {structuredIntent.map((s, i) => (
                      <p key={i} className="flex items-start gap-2 text-[12px] text-purple-800 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px text-purple-400" />{s}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <BackBtn onClick={() => setStep('outline')} />
              <div className="flex items-center gap-3">
                {intentStats.delete > 0 && (
                  <span className="text-[12px] text-zinc-500">已删除 {intentStats.delete} 个单元，将从新书目录移除对应小节</span>
                )}
                <button onClick={reconcileAndNext} disabled={reconciling}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                  {reconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  下一步：目标增补（可选） <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ④ 目标增补（可选，此时用户已看过纲要，知道缺什么）── */}
        {step === 'objectives' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6">
              <h2 className="font-semibold text-zinc-800 mb-1">目标增补<span className="ml-2 text-[11px] font-normal text-zinc-400">可选——原书提取的 {extractedCount || '若干'} 条目标已默认包含</span></h2>
              <p className="text-[12.5px] text-zinc-500 mb-4">看过纲要后，如果想让新书覆盖原书没有的目标，从库里补选；新增目标将自动规划落点（新增小节）。</p>
              <div className="grid grid-cols-2 gap-5">
                <div className="border border-zinc-100 rounded-xl overflow-hidden h-[46vh] flex flex-col">
                  <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50 shrink-0">
                    <span className="text-[11.5px] font-medium text-zinc-600">学习目标库（已选 {selectedObjectiveIds.length}）</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ObjectiveLibraryPanel libraries={libraries} objectives={objectives} mode="select"
                      selectedIds={selectedObjectiveIds} onToggle={toggleObj} onSelectAll={setSelectedObjectiveIds} />
                  </div>
                </div>
                <div className="h-[46vh] overflow-y-auto">
                  <button onClick={handleAlign} disabled={aligning || !selectedObjectiveIds.length}
                    className="w-full mb-3 flex items-center justify-center gap-1.5 py-2 text-[12.5px] border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-40">
                    {aligning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {aligning ? '对齐分析中…' : '运行覆盖度分析'}
                  </button>
                  {alignments.length > 0
                    ? <AlignmentMatrix alignments={alignments} objectives={objectives} units={knowledgeUnits} />
                    : <p className="text-center text-[12px] text-zinc-400 py-8">点击上方按钮，查看所选目标与原书内容的覆盖矩阵</p>}
                </div>
              </div>
              {addedObjectives.length > 0 && (
                <p className="mt-3 text-[12px] text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  将新增 {addedObjectives.length} 个纲要未覆盖的目标——确认方案后自动创建对应小节
                </p>
              )}
            </div>
            <div className="flex justify-between">
              <BackBtn onClick={() => setStep('intent')} />
              <button onClick={() => setStep('plan')}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                汇总改编方案 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── ⑤ 改编方案卡 ── */}
        {step === 'plan' && (
          <div className="space-y-5 max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl border-2 border-blue-200 p-7 shadow-sm">
              <h2 className="text-[16px] font-bold text-zinc-800 mb-1">改编方案卡</h2>
              <p className="text-[12px] text-zinc-400 mb-5">改什么 · 为什么 · 影响哪些章节——确认后进入工作台，纲要即新书目录，逐节生成正文</p>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <PlanStat label="保留原意改写" value={intentStats.keep} color="text-sky-600 bg-sky-50" />
                <PlanStat label="深度重写" value={intentStats.rewrite} color="text-emerald-600 bg-emerald-50" />
                <PlanStat label="删除裁剪" value={intentStats.delete} color="text-red-500 bg-red-50" />
              </div>

              <div className="space-y-3 text-[13px]">
                <PlanRow k="新书目录" v={`${chapters.length} 章 ${sections.length} 节（原书纲要 + 你的调整）`} />
                <PlanRow k="目标增补" v={addedObjectives.length ? `${addedObjectives.length} 个新目标，将自动创建覆盖小节` : '无新增（沿用原书提取的目标）'} />
                <PlanRow k="受众迁移" v={audienceNote || '未声明（沿用原书受众定位）'} />
                <PlanRow k="教学法" v={pedagogy || '未指定'} />
                {structuredIntent.length > 0 && (
                  <div className="pt-1">
                    <p className="text-zinc-400 text-[11.5px] mb-1.5">结构化改编指令</p>
                    {structuredIntent.map((s, i) => <p key={i} className="text-zinc-700 text-[12.5px] leading-relaxed">· {s}</p>)}
                  </div>
                )}
                <PlanRow k="影响章节" v={affectedChapters.length ? affectedChapters.join('、') : '按新受众与意图整体重新生成正文'} />
              </div>
            </div>

            <div className="flex justify-between">
              <BackBtn onClick={() => setStep('objectives')} />
              <button onClick={confirmAndFinish} disabled={finishing}
                className="flex items-center gap-2 px-7 py-3 text-sm bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 font-medium shadow-lg shadow-blue-200">
                {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                {finishing ? '正在落实方案…' : '确认方案，进入工作台'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function FourLayerCard({ meta, unitCount, extractedCount }: { meta: ParseMeta; unitCount: number; extractedCount: number }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-blue-500" />解构结果 · 四层信息 + 学习目标</h3>
      <div className="grid grid-cols-2 gap-4">
        <LayerBox title="结构层" items={meta.chapters.map(c => `${c.title}${c.proportion ? `（${c.proportion}）` : ''}`)} />
        <LayerBox title="知识层" items={[`共拆解 ${unitCount} 个知识单元（核心概念 / 定义 / 例题）`]} />
        <LayerBox title="教学设计层" items={[meta.teaching_design.sequence, meta.teaching_design.exercise_distribution, meta.teaching_design.difficulty_curve]} />
        <LayerBox title="风格层" items={[`语言：${meta.style.language}`, `受众假设：${meta.style.assumed_audience}`, `排版：${meta.style.layout_features}`]} />
      </div>
      {extractedCount > 0 && (
        <div className="mt-4 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-[12.5px] text-purple-800">
          <Wand2 className="w-4 h-4 shrink-0 text-purple-500" />
          AI 识别出 <b>{extractedCount} 条学习目标</b>，已入库并附着到对应章节——下一步在纲要上直接查看，无需盲选。
        </div>
      )}
    </div>
  )
}

function LayerBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-zinc-100 rounded-xl p-4 bg-zinc-50/50">
      <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">{title}</p>
      {items.filter(Boolean).map((it, i) => <p key={i} className="text-[12px] text-zinc-600 leading-relaxed">· {it}</p>)}
    </div>
  )
}

function PlanStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${color}`}>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] mt-0.5">{label}</p>
    </div>
  )
}

function PlanRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-16 text-zinc-400 text-[11.5px] pt-0.5">{k}</span>
      <span className="flex-1 text-zinc-700">{v}</span>
    </div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 px-4 py-2.5 text-sm border border-zinc-200 rounded-xl hover:bg-white text-zinc-500 transition-colors">
      <ArrowLeft className="w-4 h-4" />上一步
    </button>
  )
}

export default function ImportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>}>
      <ImportPageContent />
    </Suspense>
  )
}
