'use client'
import { useState, useEffect, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, ArrowRight, ArrowLeft, Loader2, Layers, Wand2, CheckCircle2 } from 'lucide-react'
import { useBookStore } from '@/store/bookStore'
import { ImportUploader, type ParseMeta } from '@/components/route-b/ImportUploader'
import { AlignmentMatrix } from '@/components/route-b/AlignmentMatrix'
import { ObjectiveLibraryPanel } from '@/components/objectives/ObjectiveLibraryPanel'
import type { KnowledgeUnit } from '@/types'

type Step = 'upload' | 'objectives' | 'align' | 'intent' | 'plan'

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: '① 导入解析' },
  { key: 'objectives', label: '② 目标勾选' },
  { key: 'align', label: '③ 覆盖度矩阵' },
  { key: 'intent', label: '④ 意图注入' },
  { key: 'plan', label: '⑤ 改编方案' },
]

const INTENT_OPTIONS = [
  { value: 'keep', label: '保留原意改写', cls: 'border-sky-400 bg-sky-50 text-sky-700', dot: 'bg-sky-400' },
  { value: 'rewrite', label: '深度重写', cls: 'border-emerald-400 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
  { value: 'delete', label: '删除', cls: 'border-red-300 bg-red-50 text-red-600', dot: 'bg-red-300' },
]

const PEDAGOGY_OPTIONS = ['案例驱动', '问题导向', '项目式', '讲练结合']

function ImportPageContent() {
  const searchParams = useSearchParams()
  const bookId = searchParams.get('bookId') ?? ''
  const router = useRouter()

  const {
    fetchBook, fetchObjectives, currentBook, knowledgeUnits, skeleton,
    objectives, libraries, alignments, alignObjectives, generateToc,
    selectedObjectiveIds, setSelectedObjectiveIds,
  } = useBookStore()

  const [step, setStep] = useState<Step>('upload')
  const [parseMeta, setParseMeta] = useState<ParseMeta | null>(null)
  const [extractedCount, setExtractedCount] = useState(0)
  const [aligning, setAligning] = useState(false)
  const [generating, setGenerating] = useState(false)
  // 意图注入状态
  const [unitIntents, setUnitIntents] = useState<Record<string, string>>({})
  const [audienceNote, setAudienceNote] = useState('')
  const [pedagogy, setPedagogy] = useState('')
  const [freeIntent, setFreeIntent] = useState('')
  const [structuredIntent, setStructuredIntent] = useState<string[]>([])
  const [parsingIntent, setParsingIntent] = useState(false)

  useEffect(() => { if (bookId) { fetchBook(bookId); fetchObjectives() } }, [bookId, fetchBook, fetchObjectives])
  useEffect(() => {
    // 已有骨架（回访）时恢复
    if (knowledgeUnits.length && !Object.keys(unitIntents).length) {
      setUnitIntents(Object.fromEntries(knowledgeUnits.map(u => [u.id, u.intent ?? 'keep'])))
      if (step === 'upload') setStep('objectives')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeUnits.length])

  const toggleObj = (id: string) =>
    setSelectedObjectiveIds(selectedObjectiveIds.includes(id)
      ? selectedObjectiveIds.filter(x => x !== id)
      : [...selectedObjectiveIds, id])

  async function handleAlign() {
    if (!skeleton) return
    setAligning(true)
    await alignObjectives(skeleton.id, selectedObjectiveIds)
    setAligning(false)
    setStep('align')
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

  async function confirmAndGenerate() {
    setGenerating(true)
    // 保存并确认方案卡
    await fetch('/api/adaptation-plan', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId, audience_note: audienceNote, pedagogy, free_intent: freeIntent, structured_intent: structuredIntent, confirmed: true }),
    })
    // 基于新骨架流式生成新书目录 → 进入编辑器
    await generateToc(bookId, selectedObjectiveIds)
    router.push(`/books/${bookId}`)
  }

  // 方案卡统计
  const intentStats = { keep: 0, rewrite: 0, delete: 0 }
  for (const u of knowledgeUnits) {
    const it = (unitIntents[u.id] ?? 'keep') as keyof typeof intentStats
    if (it in intentStats) intentStats[it]++
  }
  const gapObjectives = alignments.filter(a => a.status === 'gap').map(a => objectives.find(o => o.id === a.objective_id)).filter(Boolean)
  const affectedChapters = [...new Set(knowledgeUnits.filter(u => (unitIntents[u.id] ?? 'keep') !== 'keep').map(u => u.chapter_title))]

  const byChapter = knowledgeUnits.reduce<Record<string, KnowledgeUnit[]>>((a, u) => {
    ;(a[u.chapter_title] ??= []).push(u); return a
  }, {})

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-3.5 flex items-center gap-3 sticky top-0 z-20">
        <BookOpen className="w-4.5 h-4.5 w-5 h-5 text-blue-600" />
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

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ── ① 导入解析 ── */}
        {step === 'upload' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100">
                <h2 className="font-semibold text-zinc-800">上传原版教材</h2>
                <p className="text-[12.5px] text-zinc-500 mt-0.5">TXT / PDF（文本型）。AI 将解构为四层课本骨架——二创改的是骨架，不是文本。</p>
              </div>
              <ImportUploader bookId={bookId} onParsed={(_, __, meta, extractedIds) => {
                setParseMeta(meta)
                setExtractedCount(extractedIds.length)
                // AI 识别的目标自动入库并预勾选，老师可在②调整
                if (extractedIds.length) setSelectedObjectiveIds(extractedIds)
                fetchBook(bookId)
                fetchObjectives()
              }} />
            </div>
            {parseMeta && (
              <>
                <FourLayerCard meta={parseMeta} unitCount={knowledgeUnits.length} />
                {extractedCount > 0 && (
                  <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-[12.5px] text-purple-800">
                    <Wand2 className="w-4 h-4 shrink-0 text-purple-500" />
                    AI 从原书识别出 <b>{extractedCount} 条学习目标</b>，已存入学习目标库并预勾选。可在下一步调整，或随时到
                    <a href="/objectives" target="_blank" className="underline font-medium">目标库管理页</a>编辑。
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => setStep('objectives')}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                    下一步：确认学习目标 <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ② 目标勾选 + 骨架预览 ── */}
        {step === 'objectives' && (
          <div className="space-y-5">
            <div className="grid grid-cols-5 gap-5">
              <div className="col-span-2 bg-white rounded-2xl border border-zinc-200 overflow-hidden flex flex-col h-[62vh]">
                <div className="px-4 py-3 border-b border-zinc-100 shrink-0">
                  <h3 className="font-semibold text-zinc-800 text-sm">学习目标库</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">勾选新书要覆盖的目标（已选 {selectedObjectiveIds.length}）</p>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ObjectiveLibraryPanel libraries={libraries} objectives={objectives} mode="select"
                    selectedIds={selectedObjectiveIds} onToggle={toggleObj} onSelectAll={setSelectedObjectiveIds} />
                </div>
              </div>
              <div className="col-span-3 bg-white rounded-2xl border border-zinc-200 overflow-hidden flex flex-col h-[62vh]">
                <div className="px-4 py-3 border-b border-zinc-100 shrink-0">
                  <h3 className="font-semibold text-zinc-800 text-sm">原书骨架 · 知识层</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{knowledgeUnits.length} 个知识单元</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {Object.entries(byChapter).map(([ct, us]) => (
                    <div key={ct}>
                      <p className="text-[12.5px] font-bold text-zinc-700 mb-1.5">{ct}</p>
                      <div className="space-y-1.5">
                        {us.map(u => (
                          <div key={u.id} className="border border-zinc-100 rounded-lg px-3 py-2">
                            <p className="text-[12.5px] font-medium text-zinc-700">{u.core_concept}
                              <span className={`ml-2 text-[10px] px-1.5 py-px rounded ${u.difficulty === 'hard' ? 'bg-red-50 text-red-500' : u.difficulty === 'easy' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>{u.difficulty}</span>
                            </p>
                            {u.definition && <p className="text-[11.5px] text-zinc-400 mt-0.5 line-clamp-1">{u.definition}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <BackBtn onClick={() => setStep('upload')} />
              <button onClick={handleAlign} disabled={aligning || selectedObjectiveIds.length === 0}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40">
                {aligning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {aligning ? '对齐分析中…' : '运行目标对齐分析'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── ③ 覆盖度矩阵 ── */}
        {step === 'align' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6">
              <h2 className="font-semibold text-zinc-800 mb-1">目标覆盖度矩阵报告</h2>
              <p className="text-[12.5px] text-zinc-500 mb-4">原书内容与你勾选的学习目标的对齐情况——缺口是改编的增值点，冗余是可裁剪项。</p>
              <AlignmentMatrix alignments={alignments} objectives={objectives} units={knowledgeUnits} />
            </div>
            <div className="flex justify-between">
              <BackBtn onClick={() => setStep('objectives')} />
              <button onClick={() => setStep('intent')}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                进入意图注入 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── ④ 意图注入 ── */}
        {step === 'intent' && (
          <div className="space-y-5">
            {/* 单元级操作 */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6">
              <h2 className="font-semibold text-zinc-800 mb-1">单元级操作</h2>
              <p className="text-[12.5px] text-zinc-500 mb-4">在骨架上操作，不碰原文。为每个知识单元选择处置方式。</p>
              <div className="space-y-4">
                {Object.entries(byChapter).map(([ct, us]) => (
                  <div key={ct}>
                    <p className="text-[12.5px] font-bold text-zinc-700 mb-2">{ct}</p>
                    <div className="space-y-1.5">
                      {us.map(u => {
                        const cur = unitIntents[u.id] ?? 'keep'
                        return (
                          <div key={u.id} className={`flex items-center gap-3 border rounded-xl px-3.5 py-2.5 transition-colors ${cur === 'delete' ? 'border-red-100 bg-red-50/40 opacity-60' : 'border-zinc-150 border-zinc-200'}`}>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[12.5px] font-medium text-zinc-700 ${cur === 'delete' ? 'line-through' : ''}`}>{u.core_concept}</p>
                              {u.definition && <p className="text-[11px] text-zinc-400 line-clamp-1">{u.definition}</p>}
                            </div>
                            <div className="shrink-0 flex gap-1">
                              {INTENT_OPTIONS.map(opt => (
                                <button key={opt.value} onClick={() => setIntent(u.id, opt.value)}
                                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${cur === opt.value ? opt.cls + ' font-medium' : 'border-zinc-150 border-zinc-200 text-zinc-400 hover:border-zinc-300'}`}>
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

            {/* 目标增补 */}
            {gapObjectives.length > 0 && (
              <div className="bg-white rounded-2xl border border-zinc-200 p-6">
                <h2 className="font-semibold text-zinc-800 mb-1">目标增补</h2>
                <p className="text-[12.5px] text-zinc-500 mb-3">以下缺口目标将在新书中新增小节覆盖（AI 自动规划落点）：</p>
                <div className="space-y-1.5">
                  {gapObjectives.map(o => o && (
                    <p key={o.id} className="flex items-center gap-2 text-[12.5px] text-zinc-700 bg-red-50/50 border border-red-100 rounded-lg px-3 py-2">
                      <span className="text-red-400">⚠️</span>{o.description}
                      <span className="ml-auto text-[10px] text-green-600 font-medium shrink-0">→ 新增覆盖</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* 受众迁移 + 教学法 + 自由意图 */}
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
                  placeholder="例：我希望每章都从一个真实问题开始；概念讲解多用图示；把第二章的证明改成探究式引导，让学生自己发现结论。"
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

            <div className="flex justify-between">
              <BackBtn onClick={() => setStep('align')} />
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
              <p className="text-[12px] text-zinc-400 mb-5">改什么 · 为什么 · 影响哪些章节——确认后 AI 基于新骨架重新生成</p>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <PlanStat label="保留原意改写" value={intentStats.keep} color="text-sky-600 bg-sky-50" />
                <PlanStat label="深度重写" value={intentStats.rewrite} color="text-emerald-600 bg-emerald-50" />
                <PlanStat label="删除裁剪" value={intentStats.delete} color="text-red-500 bg-red-50" />
              </div>

              <div className="space-y-3 text-[13px]">
                <PlanRow k="目标增补" v={gapObjectives.length ? `${gapObjectives.length} 个缺口目标将新增小节覆盖` : '无缺口，原书覆盖完整'} />
                <PlanRow k="受众迁移" v={audienceNote || '未声明（沿用原书受众定位）'} />
                <PlanRow k="教学法" v={pedagogy || '未指定'} />
                {structuredIntent.length > 0 && (
                  <div className="pt-1">
                    <p className="text-zinc-400 text-[11.5px] mb-1.5">结构化改编指令</p>
                    {structuredIntent.map((s, i) => <p key={i} className="text-zinc-700 text-[12.5px] leading-relaxed">· {s}</p>)}
                  </div>
                )}
                <PlanRow k="影响章节" v={affectedChapters.length ? affectedChapters.join('、') : '结构微调，全书按新受众重新生成'} />
              </div>
            </div>

            <div className="flex justify-between">
              <BackBtn onClick={() => setStep('intent')} />
              <button onClick={confirmAndGenerate} disabled={generating}
                className="flex items-center gap-2 px-7 py-3 text-sm bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 font-medium shadow-lg shadow-blue-200">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                {generating ? '正在基于新骨架生成目录…' : '确认方案，生成新书'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function FourLayerCard({ meta, unitCount }: { meta: ParseMeta; unitCount: number }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-blue-500" />骨架解析结果 · 四层信息</h3>
      <div className="grid grid-cols-2 gap-4">
        <LayerBox title="结构层" items={meta.chapters.map(c => `${c.title}${c.proportion ? `（${c.proportion}）` : ''}`)} />
        <LayerBox title="知识层" items={[`共拆解 ${unitCount} 个知识单元（核心概念 / 定义 / 例题）`]} />
        <LayerBox title="教学设计层" items={[meta.teaching_design.sequence, meta.teaching_design.exercise_distribution, meta.teaching_design.difficulty_curve]} />
        <LayerBox title="风格层" items={[`语言：${meta.style.language}`, `受众假设：${meta.style.assumed_audience}`, `排版：${meta.style.layout_features}`]} />
      </div>
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
