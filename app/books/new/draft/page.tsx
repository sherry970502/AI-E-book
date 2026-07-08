'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ArrowRight, ArrowLeft, Loader2, Wand2, X, Plus, BookOpen, CheckCircle2 } from 'lucide-react'
import { useBookStore } from '@/store/bookStore'
import { GENRE_PRESETS } from '@/lib/genres'
import type { LearningObjective } from '@/types'

/**
 * 从零起草向导（线路 A 头部扩展）：
 * ① 一句话需求 → ② 定位方案卡（范围用「模块」做决定，对标主流教材惯例）
 * → ③ 学习目标确认（按模块分组，自动沉淀入目标库）→ 创建书，无缝接入现有目录生成
 * 理念：目标先于大纲——目标是体裁不变量，是全链路追溯的锚。
 */

interface Plan {
  title: string; topic: string; positioning: string
  audience_grade: string; audience_age: string; prior_level: string
  reference_note: string
  modules: { name: string; desc: string }[]
}
interface ObjGroup { module: string; objectives: LearningObjective[] }

const DIM_LABELS: Record<string, string> = {
  remember: '记忆', understand: '理解', apply: '应用', analyze: '分析', evaluate: '评价', create: '创造',
}
const STYLE_OPTIONS = [
  { value: 'academic', label: '🎓 正式学术' },
  { value: 'mixed', label: '📖 深入浅出' },
  { value: 'casual', label: '🎈 轻松可爱' },
]
const SCALE_OPTIONS = [
  { label: '小册子', words: 10000, pages: 30 },
  { label: '标准教材', words: 30000, pages: 80 },
  { label: '完整课本', words: 60000, pages: 150 },
]
const EXAMPLES = ['做一个给大学生用的生物课本', '给小学三年级孩子讲二十四节气', '面向职场新人的项目管理入门书']

export default function DraftWizardPage() {
  const router = useRouter()
  const { setSelectedObjectiveIds, fetchObjectives } = useBookStore()

  const [step, setStep] = useState<'input' | 'plan' | 'objectives'>('input')
  const [need, setNeed] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [genre, setGenre] = useState('textbook')
  const [style, setStyle] = useState('mixed')
  const [scale, setScale] = useState(SCALE_OPTIONS[1])
  const [groups, setGroups] = useState<ObjGroup[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  // ── ①→②：一句话 → 定位方案卡 ──
  async function draftPlan() {
    if (!need.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/ai/draft-positioning', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ need }),
      })
      if (res.ok) { setPlan(await res.json()); setStep('plan') }
    } finally { setBusy(false) }
  }

  // ── ②→③：确认范围 → 生成学习目标并入库 ──
  async function draftObjectives() {
    if (!plan) return
    setBusy(true)
    try {
      const res = await fetch('/api/ai/draft-objectives', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: plan.topic, audience_grade: plan.audience_grade,
          audience_age: plan.audience_age, prior_level: plan.prior_level,
          modules: plan.modules,
        }),
      })
      if (res.ok) {
        const { groups } = await res.json() as { groups: ObjGroup[] }
        setGroups(groups)
        setChecked(new Set(groups.flatMap(g => g.objectives.map(o => o.id))))  // 默认全选
        await fetchObjectives()  // 新库进全局目标库列表
        setStep('objectives')
      }
    } finally { setBusy(false) }
  }

  // ── ③：创建书 → 预选目标 → 进工作台（目录生成沿用现有流程，每步可控）──
  async function createAndGo() {
    if (!plan) return
    setCreating(true)
    try {
      const res = await fetch('/api/books', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: plan.title, topic: plan.topic, positioning: plan.positioning,
          audience_grade: plan.audience_grade, audience_age: plan.audience_age, prior_level: plan.prior_level,
          style, genre, orientation: 'portrait',
          target_word_count: scale.words, target_page_count: scale.pages,
          source: 'aigc',
        }),
      })
      const book = await res.json()
      setSelectedObjectiveIds([...checked])
      router.push(`/books/${book.id}`)
    } finally { setCreating(false) }
  }

  const toggle = (id: string) => setChecked(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next
  })
  const setModule = (i: number, patch: Partial<{ name: string; desc: string }>) =>
    setPlan(p => p ? { ...p, modules: p.modules.map((m, j) => j === i ? { ...m, ...patch } : m) } : p)

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span className="text-zinc-500 text-sm">新建课本 · 从零起草</span>
          <div className="flex-1" />
          {(['input', 'plan', 'objectives'] as const).map((k, i) => (
            <span key={k} className={`text-[12px] ${step === k ? 'font-bold text-purple-600' : 'text-zinc-300'}`}>
              {['① 一句话需求', '② 定位方案', '③ 学习目标'][i]}
            </span>
          ))}
        </div>

        {/* ── ① 一句话需求 ── */}
        {step === 'input' && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8">
            <h1 className="text-[17px] font-bold text-zinc-800 mb-1.5">只有一个大致方向？交给 AI 起草</h1>
            <p className="text-[12.5px] text-zinc-500 mb-5">
              说出你的想法——AI 会对标主流教材的覆盖惯例，起草定位方案与学习目标，你在每一步做决定。
            </p>
            <textarea value={need} onChange={e => setNeed(e.target.value)} rows={3} autoFocus
              placeholder="例：做一个给大学生用的生物课本"
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none" />
            <div className="flex flex-wrap gap-2 mt-3">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setNeed(ex)}
                  className="text-[11.5px] text-zinc-400 border border-zinc-200 rounded-lg px-2.5 py-1 hover:border-purple-300 hover:text-purple-600 transition-colors">
                  {ex}
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={draftPlan} disabled={busy || !need.trim()}
                className="flex items-center gap-2 px-6 py-3 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40 font-medium transition-colors">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {busy ? 'AI 起草中…' : 'AI 起草定位方案'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── ② 定位方案卡 ── */}
        {step === 'plan' && plan && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border-2 border-purple-200 p-7">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-[16px] font-bold text-zinc-800">定位方案卡</h2>
                  <p className="text-[11.5px] text-zinc-400 mt-0.5">{plan.reference_note}</p>
                </div>
                <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-1 rounded-full shrink-0">AI 起草 · 可编辑</span>
              </div>

              <div className="space-y-3">
                <Field label="课本名称">
                  <input value={plan.title} onChange={e => setPlan({ ...plan, title: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-[13.5px] font-medium focus:outline-none focus:ring-2 focus:ring-purple-200" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="核心主题">
                    <input value={plan.topic} onChange={e => setPlan({ ...plan, topic: e.target.value })}
                      className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-200" />
                  </Field>
                  <Field label="受众">
                    <div className="flex gap-2">
                      <input value={plan.audience_grade} onChange={e => setPlan({ ...plan, audience_grade: e.target.value })}
                        className="w-20 border border-zinc-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-200" />
                      <input value={plan.prior_level} onChange={e => setPlan({ ...plan, prior_level: e.target.value })}
                        className="flex-1 border border-zinc-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-200" />
                    </div>
                  </Field>
                </div>
                <Field label="定位（解决什么教学问题）">
                  <textarea value={plan.positioning} onChange={e => setPlan({ ...plan, positioning: e.target.value })} rows={2}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none" />
                </Field>
              </div>

              {/* 覆盖模块：范围决定在这里做（删/改/加，粗颗粒可审）*/}
              <div className="mt-5">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  覆盖范围（{plan.modules.length} 个模块）<span className="ml-2 font-normal normal-case">删掉不要的、改写描述——学习目标将严格按此生成</span>
                </p>
                <div className="space-y-2">
                  {plan.modules.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 border border-zinc-200 rounded-xl px-3.5 py-2.5 group">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-purple-50 text-purple-600 text-[10.5px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <input value={m.name} onChange={e => setModule(i, { name: e.target.value })}
                          className="w-full text-[13px] font-semibold text-zinc-800 focus:outline-none bg-transparent" />
                        <input value={m.desc} onChange={e => setModule(i, { desc: e.target.value })}
                          className="w-full text-[11.5px] text-zinc-500 focus:outline-none bg-transparent mt-0.5" />
                      </div>
                      <button onClick={() => setPlan({ ...plan, modules: plan.modules.filter((_, j) => j !== i) })}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-400 transition-all mt-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setPlan({ ...plan, modules: [...plan.modules, { name: '新模块', desc: '' }] })}
                  className="mt-2 flex items-center gap-1 text-[11.5px] text-zinc-400 hover:text-purple-600 transition-colors">
                  <Plus className="w-3 h-3" />添加模块
                </button>
              </div>

              {/* 体裁 / 风格 / 规模（轻量选择；要完整控制可走详细表单）*/}
              <div className="mt-5 pt-4 border-t border-zinc-100 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-zinc-400 w-10 shrink-0">体裁</span>
                  {GENRE_PRESETS.map(g => (
                    <button key={g.id} onClick={() => setGenre(g.id)}
                      className={`text-[11.5px] px-2.5 py-1 rounded-lg border transition-all ${genre === g.id ? 'border-purple-400 bg-purple-50 text-purple-700 font-medium' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                      {g.emoji} {g.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-zinc-400 w-10 shrink-0">风格</span>
                  {STYLE_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setStyle(s.value)}
                      className={`text-[11.5px] px-2.5 py-1 rounded-lg border transition-all ${style === s.value ? 'border-purple-400 bg-purple-50 text-purple-700 font-medium' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-zinc-400 w-10 shrink-0">规模</span>
                  {SCALE_OPTIONS.map(s => (
                    <button key={s.label} onClick={() => setScale(s)}
                      className={`text-[11.5px] px-2.5 py-1 rounded-lg border transition-all ${scale.label === s.label ? 'border-purple-400 bg-purple-50 text-purple-700 font-medium' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
                      {s.label} {s.words / 10000}万字
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <BackBtn onClick={() => setStep('input')} />
              <button onClick={draftObjectives} disabled={busy || !plan.modules.length}
                className="flex items-center gap-2 px-6 py-3 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40 font-medium transition-colors">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {busy ? '正在生成学习目标…' : '范围确认，生成学习目标'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── ③ 学习目标确认（按模块分组，已入库）── */}
        {step === 'objectives' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-zinc-200 p-7">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-[16px] font-bold text-zinc-800">学习目标（已沉淀入目标库）</h2>
                <span className="text-[11.5px] text-zinc-400">已选 {checked.size} / {groups.reduce((n, g) => n + g.objectives.length, 0)}</span>
              </div>
              <p className="text-[12px] text-zinc-500 mb-5">
                已建库「《{plan?.topic}》· AI 起草」，可稍后在目标库页继续管理。勾掉不要的——目录将按选中的目标生成，每章每节挂目标可追溯。
              </p>
              <div className="space-y-5">
                {groups.map(g => (
                  <div key={g.module}>
                    <p className="text-[12.5px] font-bold text-zinc-700 mb-2 flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-purple-400" />{g.module}
                      <span className="text-[10.5px] font-normal text-zinc-400">{g.objectives.filter(o => checked.has(o.id)).length}/{g.objectives.length}</span>
                    </p>
                    <div className="space-y-1.5">
                      {g.objectives.map(o => (
                        <label key={o.id} className={`flex items-start gap-2.5 border rounded-xl px-3.5 py-2.5 cursor-pointer transition-colors ${checked.has(o.id) ? 'border-purple-200 bg-purple-50/40' : 'border-zinc-200 opacity-60'}`}>
                          <input type="checkbox" checked={checked.has(o.id)} onChange={() => toggle(o.id)}
                            className="mt-0.5 accent-purple-600" />
                          <span className="flex-1 text-[12.5px] text-zinc-700 leading-relaxed">{o.description}</span>
                          <span className="shrink-0 text-[10px] bg-amber-50 text-amber-600 border border-amber-100 rounded px-1.5 py-px mt-0.5">
                            {DIM_LABELS[o.cognitive_dimension] ?? o.cognitive_dimension}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <BackBtn onClick={() => setStep('plan')} />
              <button onClick={createAndGo} disabled={creating || !checked.size}
                className="flex items-center gap-2 px-7 py-3 text-sm bg-purple-600 text-white rounded-2xl hover:bg-purple-700 disabled:opacity-40 font-medium shadow-lg shadow-purple-200 transition-colors">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {creating ? '创建中…' : `创建课本，进入目录设计（${checked.size} 个目标已预选）`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-zinc-400 mb-1">{label}</label>
      {children}
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
