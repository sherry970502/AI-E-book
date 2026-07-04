'use client'
import { useState } from 'react'
import { Zap, Square, Target, Loader2, CheckCircle2, Circle, Play, Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { DIMENSION_LABELS, DIMENSION_COLORS } from '@/components/objectives/ObjectiveLibraryPanel'
import type { Chapter, Section, LearningObjective } from '@/types'

interface Props {
  chapters: Chapter[]
  sections: Section[]
  objectives: LearningObjective[]
  currentPageIndex: number
  pageOfSection: Record<string, number>
  pageOfChapter: Record<string, number>
  onSelectPage: (index: number) => void
  onGenerateSection: (sectionId: string) => void
  onBatchGenerate: () => void
  onStopBatch: () => void
  isBatchRunning: boolean
  generatingSectionId: string | null
  /** 大纲直接编辑后的刷新回调 */
  onChanged: () => void
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'Pending',    cls: 'bg-zinc-100 text-zinc-400' },
  generating: { label: 'Generating', cls: 'bg-blue-100 text-blue-600' },
  completed:  { label: 'Completed',  cls: 'bg-green-100 text-green-600' },
  error:      { label: 'Error',      cls: 'bg-red-100 text-red-500' },
}

export function TOCBoard({
  chapters, sections, objectives, currentPageIndex,
  pageOfSection, pageOfChapter,
  onSelectPage, onGenerateSection, onBatchGenerate, onStopBatch,
  isBatchRunning, generatingSectionId, onChanged,
}: Props) {
  const [hoverObjChapter, setHoverObjChapter] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ kind: 'ch' | 'sec'; id: string; draft: string } | null>(null)
  const objMap = Object.fromEntries(objectives.map(o => [o.id, o]))

  const byChapter = sections.reduce<Record<string, Section[]>>((a, s) => {
    ;(a[s.chapter_id] ??= []).push(s); return a
  }, {})

  const total = sections.length
  const completed = sections.filter(s => s.status === 'completed').length
  const pending = sections.filter(s => s.status === 'pending' || s.status === 'error').length
  const partiallyDone = completed > 0 && pending > 0

  // ── 大纲直接编辑操作 ──
  async function saveRename() {
    if (!editing || !editing.draft.trim()) { setEditing(null); return }
    const url = editing.kind === 'ch' ? `/api/chapters/${editing.id}` : `/api/sections/${editing.id}`
    await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editing.draft.trim() }) })
    setEditing(null)
    onChanged()
  }
  async function removeChapter(id: string) {
    await fetch(`/api/chapters/${id}`, { method: 'DELETE' })
    onChanged()
  }
  async function removeSection(id: string) {
    await fetch(`/api/sections/${id}`, { method: 'DELETE' })
    onChanged()
  }
  async function addSection(chapterId: string, chapterIdx: number) {
    const count = (byChapter[chapterId] ?? []).length
    await fetch(`/api/chapters/${chapterId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `${chapterIdx + 1}.${count + 1} 新小节` }),
    })
    onChanged()
  }
  return (
    <div className="h-full flex flex-col">
      {/* 进度 + 批量控制 */}
      <div className="shrink-0 px-3 py-3 border-b border-zinc-100 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">大纲看板</span>
          <span className="text-[9px] text-zinc-300">悬停条目可直接编辑</span>
        </div>
        {total > 0 && (
          <>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-700"
                style={{ width: `${(completed / total) * 100}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 tabular-nums">{completed}/{total} 节完成</span>
              {isBatchRunning ? (
                <button onClick={onStopBatch}
                  className="flex items-center gap-1 text-[11px] text-red-500 border border-red-200 rounded-md px-2 py-1 hover:bg-red-50 transition-colors">
                  <Square className="w-2.5 h-2.5 fill-current" />中断
                </button>
              ) : pending > 0 ? (
                <button onClick={onBatchGenerate}
                  className="flex items-center gap-1 text-[11px] bg-blue-600 text-white rounded-md px-2 py-1 hover:bg-blue-700 transition-colors">
                  {partiallyDone ? <><Play className="w-2.5 h-2.5" />续生成 {pending} 节</> : <><Zap className="w-3 h-3" />一键批量填充</>}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* 大纲条目 */}
      <nav className="flex-1 overflow-y-auto py-1">
        {chapters.map((ch, ci) => {
          const chSecs = byChapter[ch.id] ?? []
          const chPage = pageOfChapter[ch.id]
          const isChapterActive = currentPageIndex === chPage
          const chDone = chSecs.length > 0 && chSecs.every(s => s.status === 'completed')
          const objIds = ch.objective_ids ?? []
          const isEditingCh = editing?.kind === 'ch' && editing.id === ch.id

          return (
            <div key={ch.id} className="mb-0.5">
              {/* 章条目 */}
              <div className={`group flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors ${isChapterActive ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50'}`}
                onClick={() => !isEditingCh && onSelectPage(chPage)}>
                {chDone
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  : <Circle className={`w-3.5 h-3.5 shrink-0 ${isChapterActive ? 'text-zinc-500' : 'text-zinc-300'}`} />}

                {isEditingCh ? (
                  <span className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <input value={editing.draft} autoFocus
                      onChange={e => setEditing({ ...editing, draft: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(null) }}
                      className="flex-1 text-[12px] text-zinc-800 bg-white border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none" />
                    <button onClick={saveRename}><Check className="w-3.5 h-3.5 text-green-500" /></button>
                    <button onClick={() => setEditing(null)}><X className="w-3.5 h-3.5 text-zinc-400" /></button>
                  </span>
                ) : (
                  <>
                    <span className={`flex-1 text-[12.5px] font-semibold leading-snug ${isChapterActive ? 'text-white' : 'text-zinc-800'}`}>{ch.title}</span>
                    {/* 编辑操作（悬停显示） */}
                    <span className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <IconBtn title="重命名" onClick={() => setEditing({ kind: 'ch', id: ch.id, draft: ch.title })} dark={isChapterActive}><Pencil className="w-3 h-3" /></IconBtn>
                      <IconBtn title="添加小节" onClick={() => addSection(ch.id, ci)} dark={isChapterActive}><Plus className="w-3 h-3" /></IconBtn>
                      <IconBtn title="删除本章" onClick={() => removeChapter(ch.id)} dark={isChapterActive} danger><Trash2 className="w-3 h-3" /></IconBtn>
                    </span>
                    {objIds.length > 0 && (
                      <span className="relative shrink-0 group-hover:hidden"
                        onMouseEnter={() => setHoverObjChapter(ch.id)}
                        onMouseLeave={() => setHoverObjChapter(null)}>
                        <span className={`text-[10px] px-1 py-px rounded ${isChapterActive ? 'bg-zinc-700 text-zinc-300' : 'bg-amber-50 text-amber-600'}`}>
                          🎯×{objIds.length}
                        </span>
                        {hoverObjChapter === ch.id && (
                          <span className="absolute left-full top-0 ml-2 z-30 w-60 bg-white border border-zinc-200 rounded-xl shadow-xl p-3 space-y-1.5 block">
                            {objIds.map(oid => {
                              const o = objMap[oid]
                              if (!o) return null
                              return (
                                <span key={oid} className="flex items-start gap-1.5 text-left">
                                  <span className={`shrink-0 mt-px px-1 py-px rounded text-[9px] font-medium ${DIMENSION_COLORS[o.cognitive_dimension] ?? ''}`}>
                                    {DIMENSION_LABELS[o.cognitive_dimension] ?? ''}
                                  </span>
                                  <span className="text-[11px] text-zinc-600 leading-snug">{o.description}</span>
                                </span>
                              )
                            })}
                          </span>
                        )}
                      </span>
                    )}
                    <span className={`shrink-0 text-[10px] tabular-nums group-hover:hidden ${isChapterActive ? 'text-zinc-400' : 'text-zinc-300'}`}>P.{chPage + 1}</span>
                  </>
                )}
              </div>

              {/* 节条目 */}
              <ul>
                {chSecs.map(sec => {
                  const page = pageOfSection[sec.id]
                  const active = currentPageIndex === page
                  const isGen = generatingSectionId === sec.id
                  const badge = STATUS_BADGE[isGen ? 'generating' : sec.status] ?? STATUS_BADGE.pending
                  const isEditingSec = editing?.kind === 'sec' && editing.id === sec.id
                  return (
                    <li key={sec.id}
                      className={`group flex items-center gap-1.5 pl-8 pr-3 py-1.5 cursor-pointer transition-colors ${active ? 'bg-blue-50' : 'hover:bg-zinc-50'}`}
                      onClick={() => !isEditingSec && onSelectPage(page)}>
                      {isEditingSec ? (
                        <span className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input value={editing.draft} autoFocus
                            onChange={e => setEditing({ ...editing, draft: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(null) }}
                            className="flex-1 text-[11.5px] text-zinc-800 bg-white border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none" />
                          <button onClick={saveRename}><Check className="w-3.5 h-3.5 text-green-500" /></button>
                          <button onClick={() => setEditing(null)}><X className="w-3.5 h-3.5 text-zinc-400" /></button>
                        </span>
                      ) : (
                        <>
                          <span className={`shrink-0 text-[12px] leading-snug ${active ? 'text-blue-800 font-medium' : 'text-zinc-600'}`}>{sec.title}</span>
                          <span className="flex-1 border-b border-dotted border-zinc-200 mx-0.5 translate-y-[1px] min-w-[8px]" />
                          {/* 编辑操作 */}
                          <span className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                            {(sec.status === 'pending' || sec.status === 'error') && !isBatchRunning && !isGen && (
                              <IconBtn title="生成本节" onClick={() => onGenerateSection(sec.id)}><Zap className="w-3 h-3 text-blue-500" /></IconBtn>
                            )}
                            <IconBtn title="重命名" onClick={() => setEditing({ kind: 'sec', id: sec.id, draft: sec.title })}><Pencil className="w-3 h-3" /></IconBtn>
                            <IconBtn title="删除本节" onClick={() => removeSection(sec.id)} danger><Trash2 className="w-3 h-3" /></IconBtn>
                          </span>
                          <span className={`shrink-0 text-[10px] tabular-nums group-hover:hidden ${active ? 'text-blue-500' : 'text-zinc-400'}`}>P.{page + 1}</span>
                          <span className={`shrink-0 text-[9px] font-medium px-1.5 py-px rounded-full group-hover:hidden ${badge.cls} ${isGen ? 'animate-pulse' : ''}`}>
                            {isGen ? <span className="flex items-center gap-0.5"><Loader2 className="w-2 h-2 animate-spin" />{badge.label}</span> : badge.label}
                          </span>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* 目标覆盖小结 */}
      <div className="shrink-0 px-3 py-2 border-t border-zinc-100 flex items-center gap-1.5">
        <Target className="w-3 h-3 text-zinc-300" />
        <span className="text-[10px] text-zinc-400">
          全书关联 {new Set([...chapters.flatMap(c => c.objective_ids), ...sections.flatMap(s => s.objective_ids)]).size} 个学习目标
        </span>
      </div>
    </div>
  )
}

function IconBtn({ children, title, onClick, dark, danger }: {
  children: React.ReactNode; title: string; onClick: () => void; dark?: boolean; danger?: boolean
}) {
  return (
    <button title={title} onClick={onClick}
      className={`p-1 rounded transition-colors ${
        danger ? (dark ? 'text-zinc-400 hover:text-red-400' : 'text-zinc-400 hover:text-red-500 hover:bg-red-50')
          : (dark ? 'text-zinc-400 hover:text-white' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100')}`}>
      {children}
    </button>
  )
}

