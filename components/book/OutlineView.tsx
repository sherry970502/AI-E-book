'use client'
import { useState } from 'react'
import { Target, Pencil, X, ArrowRight, Plus, BookOpen } from 'lucide-react'
import { DIMENSION_LABELS, DIMENSION_COLORS } from '@/components/objectives/ObjectiveLibraryPanel'
import type { Chapter, Section, LearningObjective } from '@/types'

/**
 * 大纲调整视图：正文生成前的独立环节（需求：老师抓大放小，先定脉络与目标）。
 * 章级 = 教学大纲 + 覆盖目标；节级 = 教学要点 + 覆盖目标。全部可直接编辑，也可与主编对话调整。
 */

interface Props {
  chapters: Chapter[]
  sections: Section[]
  objectives: LearningObjective[]
  onChanged: () => void
  onConfirm: () => void
}

export function OutlineView({ chapters, sections, objectives, onChanged, onConfirm }: Props) {
  const objMap = Object.fromEntries(objectives.map(o => [o.id, o]))
  const byChapter = sections.reduce<Record<string, Section[]>>((a, s) => {
    ;(a[s.chapter_id] ??= []).push(s); return a
  }, {})

  const allObjIds = new Set([...chapters.flatMap(c => c.objective_ids), ...sections.flatMap(s => s.objective_ids)])
  const completed = sections.filter(s => s.status === 'completed').length

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* 头部 */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-[17px] font-bold text-zinc-800">教学大纲</h2>
            <p className="text-[12px] text-zinc-400 mt-1">
              学习目标决定教学内容——先在这里确认全书脉络与目标覆盖，再进入正文创作。<br />
              所有内容可直接点击编辑，也可以让右侧主编帮你调（如「把 1.2 的要点改得更侧重图像直觉」）。
            </p>
          </div>
          <button onClick={onConfirm}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-[13px] font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
            {completed > 0 ? '继续正文创作' : '确认大纲，开始创作正文'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 全书目标覆盖摘要 */}
        <div className="flex items-center gap-2 mb-5 text-[11.5px] text-zinc-500 bg-amber-50/60 border border-amber-100 rounded-xl px-4 py-2.5">
          <Target className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          全书共覆盖 <b className="text-amber-700">{allObjIds.size}</b> 个学习目标 · {chapters.length} 章 {sections.length} 节
          {completed > 0 && <span className="ml-auto text-green-600">{completed} 节已有正文（改大纲不影响已生成内容）</span>}
        </div>

        {/* 章卡片 */}
        <div className="space-y-5">
          {chapters.map((ch, ci) => (
            <ChapterCard key={ch.id} chapter={ch} index={ci}
              sections={byChapter[ch.id] ?? []}
              objMap={objMap} objectives={objectives} onChanged={onChanged} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 章卡片：教学大纲 + 覆盖目标 ──────────────────────────────────────────────
function ChapterCard({ chapter, index, sections, objMap, objectives, onChanged }: {
  chapter: Chapter; index: number; sections: Section[]
  objMap: Record<string, LearningObjective>; objectives: LearningObjective[]
  onChanged: () => void
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
      {/* 章头 */}
      <div className="px-5 pt-4 pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-zinc-800 text-white text-[12px] font-bold flex items-center justify-center">{index + 1}</span>
          <EditableText value={chapter.title} bold
            onSave={async v => { await patchChapter(chapter.id, { title: v }); onChanged() }} />
        </div>
        {/* 教学大纲（本章讲什么） */}
        <div className="mt-2.5 pl-10">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">本章教学大纲</p>
          <EditableText value={chapter.summary ?? ''} multiline placeholder="本章讲什么、如何递进…（点击填写）"
            onSave={async v => { await patchChapter(chapter.id, { summary: v }); onChanged() }} />
        </div>
        {/* 章级目标 */}
        <div className="mt-2.5 pl-10">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">本章覆盖的学习目标</p>
          <ObjectiveChips ids={chapter.objective_ids} objMap={objMap} objectives={objectives}
            onSave={async ids => { await patchChapter(chapter.id, { objective_ids: ids }); onChanged() }} />
        </div>
      </div>

      {/* 节列表：教学要点 + 目标 */}
      <ul className="divide-y divide-zinc-50">
        {sections.map(sec => (
          <li key={sec.id} className="px-5 py-3.5 pl-[60px]">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
              <EditableText value={sec.title} semibold
                onSave={async v => { await patchSection(sec.id, { title: v }); onChanged() }} />
              {sec.status === 'completed' && <span className="text-[9px] bg-green-50 text-green-600 px-1.5 py-px rounded-full shrink-0">已有正文</span>}
            </div>
            <div className="mt-1.5 pl-6">
              <EditableText value={sec.brief} multiline small placeholder="本节教学要点：具体讲哪些内容…（点击填写）"
                onSave={async v => { await patchSection(sec.id, { brief: v }); onChanged() }} />
            </div>
            <div className="mt-2 pl-6">
              <ObjectiveChips ids={sec.objective_ids} objMap={objMap} objectives={objectives} small
                onSave={async ids => { await patchSection(sec.id, { objective_ids: ids }); onChanged() }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

async function patchChapter(id: string, body: Record<string, unknown>) {
  await fetch(`/api/chapters/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
async function patchSection(id: string, body: Record<string, unknown>) {
  await fetch(`/api/sections/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

// ─── 可编辑文本（点击即改，回车/失焦保存）─────────────────────────────────────
function EditableText({ value, onSave, multiline, bold, semibold, small, placeholder }: {
  value: string
  onSave: (v: string) => void
  multiline?: boolean
  bold?: boolean
  semibold?: boolean
  small?: boolean
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    setEditing(false)
    if (draft.trim() !== value) onSave(draft.trim())
  }

  if (editing) {
    return multiline ? (
      <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus rows={2}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } if (e.key === 'Escape') setEditing(false) }}
        className={`w-full ${small ? 'text-[12px]' : 'text-[12.5px]'} text-zinc-700 border border-blue-300 rounded-lg px-2.5 py-1.5 focus:outline-none resize-none bg-white`} />
    ) : (
      <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className={`flex-1 min-w-0 ${bold ? 'text-[15px] font-bold' : semibold ? 'text-[13px] font-semibold' : 'text-[12.5px]'} text-zinc-800 border border-blue-300 rounded-lg px-2 py-1 focus:outline-none bg-white`} />
    )
  }
  return (
    <button onClick={() => { setDraft(value); setEditing(true) }}
      className={`group/et text-left flex items-start gap-1.5 rounded-md -mx-1 px-1 hover:bg-blue-50/60 transition-colors ${multiline ? 'w-full' : 'flex-1 min-w-0'}`}>
      <span className={`${bold ? 'text-[15px] font-bold text-zinc-800' : semibold ? 'text-[13px] font-semibold text-zinc-700' : small ? 'text-[12px] text-zinc-500' : 'text-[12.5px] text-zinc-600'} leading-relaxed ${!value ? 'italic text-zinc-300' : ''}`}>
        {value || placeholder || '（点击填写）'}
      </span>
      <Pencil className="w-3 h-3 text-zinc-300 opacity-0 group-hover/et:opacity-100 shrink-0 mt-1 transition-opacity" />
    </button>
  )
}

// ─── 目标芯片（可增删）────────────────────────────────────────────────────────
function ObjectiveChips({ ids, objMap, objectives, onSave, small }: {
  ids: string[]
  objMap: Record<string, LearningObjective>
  objectives: LearningObjective[]
  onSave: (ids: string[]) => void
  small?: boolean
}) {
  const [picking, setPicking] = useState(false)
  const remaining = objectives.filter(o => !ids.includes(o.id))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ids.map(oid => {
        const o = objMap[oid]
        if (!o) return null
        return (
          <span key={oid} className={`group/chip inline-flex items-center gap-1 ${small ? 'text-[10.5px]' : 'text-[11px]'} bg-amber-50 border border-amber-100 text-amber-800 rounded-lg px-2 py-1`}>
            <span className={`px-1 py-px rounded text-[9px] font-medium ${DIMENSION_COLORS[o.cognitive_dimension] ?? ''}`}>
              {DIMENSION_LABELS[o.cognitive_dimension] ?? ''}
            </span>
            <span className="max-w-[260px] truncate" title={o.description}>{o.description}</span>
            <button onClick={() => onSave(ids.filter(x => x !== oid))}
              className="opacity-0 group-hover/chip:opacity-100 text-amber-400 hover:text-red-500 transition-opacity" title="移除此目标">
              <X className="w-3 h-3" />
            </button>
          </span>
        )
      })}
      {ids.length === 0 && <span className="text-[10.5px] text-red-400">⚠ 未关联目标</span>}
      {picking ? (
        <span className="inline-flex items-center gap-1">
          <select autoFocus
            onChange={e => { if (e.target.value) onSave([...ids, e.target.value]); setPicking(false) }}
            onBlur={() => setPicking(false)}
            className="text-[11px] border border-zinc-200 rounded-lg px-1.5 py-1 max-w-[280px] focus:outline-none bg-white">
            <option value="">选择要添加的目标…</option>
            {remaining.map(o => (
              <option key={o.id} value={o.id}>[{DIMENSION_LABELS[o.cognitive_dimension] ?? ''}] {o.description.slice(0, 40)}</option>
            ))}
          </select>
          <button onClick={() => setPicking(false)}><X className="w-3 h-3 text-zinc-400" /></button>
        </span>
      ) : (
        <button onClick={() => setPicking(true)}
          className="inline-flex items-center gap-0.5 text-[10.5px] text-zinc-400 border border-dashed border-zinc-200 rounded-lg px-2 py-1 hover:border-amber-300 hover:text-amber-600 transition-colors">
          <Plus className="w-3 h-3" />添加目标
        </button>
      )}
    </div>
  )
}
