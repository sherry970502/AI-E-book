'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, ArrowRight, Sparkles, FileUp } from 'lucide-react'
import { useBookStore } from '@/store/bookStore'
import { GENRE_PRESETS } from '@/lib/genres'

// ─── 风格预设（附示例文案预览）────────────────────────────────────────────────
const STYLE_PRESETS = [
  {
    value: 'academic', label: '正式学术', emoji: '🎓',
    desc: '引用规范，逻辑严密',
    sample: '「定义 1.1：设 f 为集合 A 到集合 B 的映射。若对任意 x∈A，存在唯一 y∈B 与之对应，则称……」',
  },
  {
    value: 'mixed', label: '深入浅出', emoji: '📖',
    desc: '兼顾深度与可读性',
    sample: '「函数就像一台自动售货机：投入一枚硬币（输入），必然掉出一瓶确定的饮料（输出）。严格地说……」',
  },
  {
    value: 'casual', label: '轻松可爱', emoji: '🎈',
    desc: '多用类比，语气亲切',
    sample: '「想象你有一只会变魔法的小盒子！放进去一个数字，它就吐出另一个数字——这就是今天的主角：函数！」',
  },
]

// ─── 受众 → 推荐风格联动 ─────────────────────────────────────────────────────
const GRADE_OPTIONS = [
  { value: '小学', age: '6-12岁', prior: '零基础', recommend: 'casual' },
  { value: '初中', age: '12-15岁', prior: '有小学基础', recommend: 'mixed' },
  { value: '高中', age: '15-18岁', prior: '有初中基础', recommend: 'mixed' },
  { value: '大学', age: '18-22岁', prior: '有高中基础', recommend: 'academic' },
  { value: '成人/职业', age: '22岁以上', prior: '视具体背景', recommend: 'mixed' },
]

// ─── 开本预设（决定排版引擎版心参数）──────────────────────────────────────────
const FORMAT_PRESETS = [
  { value: 'portrait', label: 'A4 竖版', ratio: '210×297', desc: '经典教材开本，适合正文密集型', w: 7, h: 9.9 },
  { value: 'landscape', label: '16:9 横版', ratio: '336×189', desc: '适合图表丰富、演示型内容', w: 9.9, h: 5.56 },
]

const SCALE_PRESETS = [
  { label: '小册子', words: 10000, pages: 30 },
  { label: '标准教材', words: 30000, pages: 80 },
  { label: '完整课本', words: 60000, pages: 150 },
]

export default function NewBookPage() {
  const router = useRouter()
  const { createBook } = useBookStore()
  const [form, setForm] = useState({
    title: '',
    topic: '',
    positioning: '',
    audience_grade: '高中',
    audience_age: '15-18岁',
    prior_level: '有初中基础',
    style: 'mixed',
    genre: 'textbook',
    orientation: 'portrait' as 'portrait' | 'landscape',
    target_word_count: 30000,
    target_page_count: 80,
    source: 'aigc' as 'aigc' | 'adaptation',
  })
  const [styleTouched, setStyleTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  function set(key: string, val: unknown) {
    setForm(f => ({ ...f, [key]: val }))
  }

  // 受众联动：选择学段自动带出年龄/先验，并推荐风格（用户手选过则不覆盖）
  function pickGrade(g: typeof GRADE_OPTIONS[number]) {
    setForm(f => ({
      ...f,
      audience_grade: g.value,
      audience_age: g.age,
      prior_level: g.prior,
      style: styleTouched ? f.style : g.recommend,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const book = await createBook({ ...form, id: crypto.randomUUID() })
      router.push(form.source === 'adaptation' ? `/books/new/import?bookId=${book.id}` : `/books/${book.id}`)
    } finally {
      setSaving(false)
    }
  }

  const activeStyle = STYLE_PRESETS.find(s => s.value === form.style)
  const recommendedStyle = GRADE_OPTIONS.find(g => g.value === form.audience_grade)?.recommend

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <span className="text-zinc-500 text-sm">新建课本 · 初始定位</span>
        </div>

        {/* 从零起草入口：只有一句话想法时，AI 起草定位方案+学习目标（目标先于大纲）*/}
        <button type="button" onClick={() => router.push('/books/new/draft')}
          className="w-full mb-5 flex items-center gap-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-2xl px-5 py-4 text-left hover:border-purple-300 transition-colors group">
          <Sparkles className="w-5 h-5 text-purple-500 shrink-0" />
          <span className="flex-1">
            <span className="block text-[13.5px] font-semibold text-zinc-800">只有一个大致方向？让 AI 从零起草</span>
            <span className="block text-[11.5px] text-zinc-500 mt-0.5">一句话（如「给大学生做本生物课本」）→ 定位方案 → 学习目标 → 直接进目录设计</span>
          </span>
          <ArrowRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ① 创作线路 */}
          <section className="bg-white rounded-2xl border border-zinc-200 p-6">
            <h2 className="text-sm font-bold text-zinc-800 mb-3">创作线路</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'aigc', icon: Sparkles, label: '线路 A · 纯 AIGC 生成', desc: 'AI 在学习目标库支撑下，从目录到正文全程生成' },
                { value: 'adaptation', icon: FileUp, label: '线路 B · 现有课本二创', desc: '导入原书 → 解析骨架 → 注入教学意图 → 重新生成' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => set('source', opt.value)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${form.source === opt.value ? 'border-blue-500 bg-blue-50/50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                  <opt.icon className={`w-5 h-5 mb-2 ${form.source === opt.value ? 'text-blue-600' : 'text-zinc-400'}`} />
                  <span className="block font-semibold text-zinc-800 text-sm">{opt.label}</span>
                  <span className="block text-xs text-zinc-500 mt-1 leading-relaxed">{opt.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ② 主题与定位 */}
          <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-zinc-800">主题与定位</h2>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">课本主题名称 *</label>
              <input required value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="例：高中数学 · 函数与极限"
                className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">核心主题 *</label>
              <input required value={form.topic} onChange={e => set('topic', e.target.value)}
                placeholder="例：函数概念与极限思想"
                className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">原始需求定位——这本书解决什么教学问题？</label>
              <textarea value={form.positioning} onChange={e => set('positioning', e.target.value)} rows={3}
                placeholder="例：现行教材对函数概念的引入过于形式化，学生缺乏直觉。本书侧重概念直觉的建立，用大量真实情境铺垫，再过渡到严格定义。"
                className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
            </div>
          </section>

          {/* ③ 目标受众（联动推荐风格）*/}
          <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-zinc-800">目标受众<span className="ml-2 text-xs font-normal text-zinc-400">选择学段自动联动推荐风格</span></h2>
            <div className="flex flex-wrap gap-2">
              {GRADE_OPTIONS.map(g => (
                <button key={g.value} type="button" onClick={() => pickGrade(g)}
                  className={`px-4 py-2 rounded-xl border text-sm transition-all ${form.audience_grade === g.value ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                  {g.value}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">年龄段</label>
                <input value={form.audience_age} onChange={e => set('audience_age', e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">先验水平</label>
                <input value={form.prior_level} onChange={e => set('prior_level', e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>
          </section>

          {/* ④ 体裁（体裁定骨：贯穿目录结构、正文脉络、文字表达三层）*/}
          <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-zinc-800">体裁<span className="ml-2 text-xs font-normal text-zinc-400">决定这本书「长什么样」——从目录结构到正文表达</span></h2>
            <div className="grid grid-cols-4 gap-3">
              {GENRE_PRESETS.map(g => (
                <button key={g.id} type="button" onClick={() => set('genre', g.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${form.genre === g.id ? 'border-blue-500 bg-blue-50/50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                  <span className="text-lg">{g.emoji}</span>
                  <span className="block font-semibold text-zinc-800 text-sm mt-1">{g.label}</span>
                  <span className="block text-[11px] text-zinc-400 mt-0.5 leading-snug">{g.desc}</span>
                </button>
              ))}
            </div>
            {(() => {
              const g = GENRE_PRESETS.find(x => x.id === form.genre)
              return g ? (
                <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">同一主题在该体裁下的样貌</p>
                  <p className="text-[13px] text-zinc-600 leading-relaxed italic">{g.sample}</p>
                </div>
              ) : null
            })()}
          </section>

          {/* ⑤ 整体风格（体裁内的微调：同一体裁可严谨可活泼）*/}
          <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-zinc-800">整体风格<span className="ml-2 text-xs font-normal text-zinc-400">体裁内的语气微调</span></h2>
            <div className="grid grid-cols-3 gap-3">
              {STYLE_PRESETS.map(s => (
                <button key={s.value} type="button"
                  onClick={() => { set('style', s.value); setStyleTouched(true) }}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all ${form.style === s.value ? 'border-blue-500 bg-blue-50/50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                  {recommendedStyle === s.value && (
                    <span className="absolute -top-2 right-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-px rounded-full font-medium">受众推荐</span>
                  )}
                  <span className="text-lg">{s.emoji}</span>
                  <span className="block font-semibold text-zinc-800 text-sm mt-1">{s.label}</span>
                  <span className="block text-[11px] text-zinc-400 mt-0.5">{s.desc}</span>
                </button>
              ))}
            </div>
            {activeStyle && (
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">示例文案预览</p>
                <p className="text-[13px] text-zinc-600 leading-relaxed italic">{activeStyle.sample}</p>
              </div>
            )}
          </section>

          {/* ⑤ 开本 */}
          <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-3">
            <h2 className="text-sm font-bold text-zinc-800">书的开本<span className="ml-2 text-xs font-normal text-zinc-400">决定排版引擎的版心参数</span></h2>
            <div className="grid grid-cols-2 gap-3">
              {FORMAT_PRESETS.map(f => (
                <button key={f.value} type="button" onClick={() => set('orientation', f.value)}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${form.orientation === f.value ? 'border-blue-500 bg-blue-50/50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                  <div className="shrink-0 border-2 border-zinc-300 rounded-sm bg-white"
                    style={{ width: f.w * 4, height: f.h * 4 }} />
                  <div className="text-left">
                    <span className="block font-semibold text-zinc-800 text-sm">{f.label}</span>
                    <span className="block text-[11px] text-zinc-400">{f.ratio} mm · {f.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ⑥ 内容规模 */}
          <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-zinc-800">内容规模<span className="ml-2 text-xs font-normal text-zinc-400">AI 据此规划章节数量与每节篇幅</span></h2>
            <div className="flex gap-2">
              {SCALE_PRESETS.map(p => (
                <button key={p.label} type="button"
                  onClick={() => { set('target_word_count', p.words); set('target_page_count', p.pages) }}
                  className={`px-4 py-2 rounded-xl border text-sm transition-all ${form.target_word_count === p.words ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                  {p.label}<span className="text-xs text-zinc-400 ml-1">{p.words / 10000}万字/{p.pages}页</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">预计总字数</label>
                <input type="number" value={form.target_word_count} onChange={e => set('target_word_count', Number(e.target.value))}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">预计页数</label>
                <input type="number" value={form.target_page_count} onChange={e => set('target_page_count', Number(e.target.value))}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>
          </section>

          <button type="submit" disabled={saving || !form.title || !form.topic}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-40 font-medium transition-colors">
            {saving ? '创建中…' : (<>{form.source === 'aigc' ? '进入目录设计' : '上传原书'} <ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>
      </div>
    </div>
  )
}
