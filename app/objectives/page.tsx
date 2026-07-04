'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Target, Plus, Pencil, Trash2, Check, X, Loader2, Sparkles } from 'lucide-react'
import { DIMENSION_LABELS, DIMENSION_COLORS } from '@/components/objectives/ObjectiveLibraryPanel'
import type { LearningObjective, ObjectiveLibrary, CognitiveDimension } from '@/types'

const DIMS: CognitiveDimension[] = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']

export default function ObjectivesAdminPage() {
  const [libraries, setLibraries] = useState<ObjectiveLibrary[]>([])
  const [objectives, setObjectives] = useState<LearningObjective[]>([])
  const [activeLib, setActiveLib] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/objectives')
    const { libraries, objectives } = await res.json()
    setLibraries(libraries)
    setObjectives(objectives)
    setLoading(false)
    setActiveLib(prev => prev || libraries[0]?.id || '')
  }, [])
  useEffect(() => { load() }, [load])

  const visible = objectives.filter(o => o.library_id === activeLib)
  const activeLibrary = libraries.find(l => l.id === activeLib)

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-zinc-400 hover:text-zinc-700"><ArrowLeft className="w-4 h-4" /></Link>
        <Target className="w-4.5 h-4.5 w-5 h-5 text-amber-500" />
        <div>
          <h1 className="text-sm font-bold text-zinc-800">学习目标库管理</h1>
          <p className="text-[11px] text-zinc-400">独立管理的目标资产——改编解析出的目标自动入库，可在此调整后用于任何课本</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* 库切换 */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {libraries.map(lib => (
            <button key={lib.id} onClick={() => setActiveLib(lib.id)}
              className={`flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-xl border transition-all ${
                activeLib === lib.id ? 'border-amber-400 bg-amber-50 text-amber-800 font-medium' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'}`}>
              {lib.name.includes('AI 提取') && <Sparkles className="w-3 h-3 text-purple-400" />}
              {lib.name}
              <span className="text-[10px] text-zinc-400">{objectives.filter(o => o.library_id === lib.id).length}</span>
            </button>
          ))}
        </div>

        {/* 目标列表 */}
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-zinc-800">{activeLibrary?.name}</h2>
              <p className="text-[11px] text-zinc-400">{activeLibrary?.subject} {activeLibrary?.grade_level} · {visible.length} 条目标</p>
            </div>
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-[12px] bg-zinc-900 text-white rounded-lg px-3 py-1.5 hover:bg-zinc-700">
              <Plus className="w-3.5 h-3.5" />新增目标
            </button>
          </div>

          {adding && <ObjectiveForm libraryId={activeLib} onDone={() => { setAdding(false); load() }} onCancel={() => setAdding(false)} />}

          <div className="divide-y divide-zinc-50">
            {visible.map(o => <ObjectiveRow key={o.id} o={o} onChange={load} />)}
            {visible.length === 0 && !adding && (
              <p className="text-center text-sm text-zinc-400 py-10">此库暂无目标</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function ObjectiveRow({ o, onChange }: { o: LearningObjective; onChange: () => void }) {
  const [editing, setEditing] = useState(false)
  const [desc, setDesc] = useState(o.description)
  const [dim, setDim] = useState(o.cognitive_dimension)

  async function save() {
    await fetch(`/api/objectives/${o.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, cognitive_dimension: dim }),
    })
    setEditing(false)
    onChange()
  }
  async function remove() {
    await fetch(`/api/objectives/${o.id}`, { method: 'DELETE' })
    onChange()
  }

  if (editing) {
    return (
      <div className="px-5 py-3 bg-amber-50/40 space-y-2">
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} autoFocus
          className="w-full text-[13px] border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none" />
        <div className="flex items-center gap-1.5">
          {DIMS.map(d => (
            <button key={d} onClick={() => setDim(d)}
              className={`text-[10.5px] px-2 py-1 rounded ${dim === d ? DIMENSION_COLORS[d] + ' font-semibold ring-1 ring-current' : 'bg-zinc-50 text-zinc-400'}`}>
              {DIMENSION_LABELS[d]}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={save} className="flex items-center gap-1 text-[11px] bg-green-600 text-white rounded-md px-2.5 py-1"><Check className="w-3 h-3" />保存</button>
          <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-[11px] border border-zinc-200 text-zinc-500 rounded-md px-2.5 py-1"><X className="w-3 h-3" />取消</button>
        </div>
      </div>
    )
  }
  return (
    <div className="group flex items-start gap-3 px-5 py-3 hover:bg-zinc-50/60">
      <span className={`shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${DIMENSION_COLORS[o.cognitive_dimension] ?? 'bg-zinc-100'}`}>
        {DIMENSION_LABELS[o.cognitive_dimension] ?? o.cognitive_dimension}
      </span>
      <p className="flex-1 text-[13px] text-zinc-700 leading-relaxed">{o.description}</p>
      <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-zinc-100" title="编辑"><Pencil className="w-3.5 h-3.5 text-zinc-400" /></button>
        <button onClick={remove} className="p-1.5 rounded hover:bg-red-50" title="删除"><Trash2 className="w-3.5 h-3.5 text-zinc-400 hover:text-red-500" /></button>
      </div>
    </div>
  )
}

function ObjectiveForm({ libraryId, onDone, onCancel }: { libraryId: string; onDone: () => void; onCancel: () => void }) {
  const [desc, setDesc] = useState('')
  const [dim, setDim] = useState<CognitiveDimension>('understand')

  async function submit() {
    if (!desc.trim()) return
    await fetch('/api/objectives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library_id: libraryId, description: desc, cognitive_dimension: dim }),
    })
    onDone()
  }
  return (
    <div className="px-5 py-3.5 bg-blue-50/40 border-b border-blue-100 space-y-2">
      <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} autoFocus
        placeholder="学完后学生能……（用可测量的行为动词描述）"
        className="w-full text-[13px] border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
      <div className="flex items-center gap-1.5">
        {DIMS.map(d => (
          <button key={d} onClick={() => setDim(d)}
            className={`text-[10.5px] px-2 py-1 rounded ${dim === d ? DIMENSION_COLORS[d] + ' font-semibold ring-1 ring-current' : 'bg-zinc-50 text-zinc-400'}`}>
            {DIMENSION_LABELS[d]}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={submit} disabled={!desc.trim()} className="text-[11px] bg-zinc-900 text-white rounded-md px-3 py-1 disabled:opacity-40">添加</button>
        <button onClick={onCancel} className="text-[11px] border border-zinc-200 text-zinc-500 rounded-md px-3 py-1">取消</button>
      </div>
    </div>
  )
}
