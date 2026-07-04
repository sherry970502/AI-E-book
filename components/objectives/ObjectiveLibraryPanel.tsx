'use client'
import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, Circle, Target, Crosshair } from 'lucide-react'
import type { LearningObjective, ObjectiveLibrary } from '@/types'

export const DIMENSION_LABELS: Record<string, string> = {
  remember: '记忆', understand: '理解', apply: '应用',
  analyze: '分析', evaluate: '评价', create: '创造',
}

export const DIMENSION_COLORS: Record<string, string> = {
  remember: 'bg-zinc-100 text-zinc-600',
  understand: 'bg-blue-100 text-blue-700',
  apply: 'bg-green-100 text-green-700',
  analyze: 'bg-yellow-100 text-yellow-700',
  evaluate: 'bg-orange-100 text-orange-700',
  create: 'bg-purple-100 text-purple-700',
}

interface Props {
  libraries: ObjectiveLibrary[]
  objectives: LearningObjective[]
  /** select = 目录设计阶段勾选；trace = 制作阶段双向追溯 */
  mode?: 'select' | 'trace'
  // select 模式
  selectedIds?: string[]
  onToggle?: (id: string) => void
  onSelectAll?: (ids: string[]) => void
  // trace 模式
  coverage?: Record<string, number>          // objectiveId → 覆盖段落数
  highlightObjectiveId?: string | null       // 当前正查的目标
  reverseHighlightIds?: string[]             // 点段落反查出的目标集合
  onTrace?: (id: string | null) => void
}

export function ObjectiveLibraryPanel({
  libraries, objectives, mode = 'select',
  selectedIds = [], onToggle, onSelectAll,
  coverage = {}, highlightObjectiveId, reverseHighlightIds = [], onTrace,
}: Props) {
  const [openLibs, setOpenLibs] = useState<Set<string>>(new Set(libraries.map(l => l.id)))

  const byLib = objectives.reduce<Record<string, LearningObjective[]>>((acc, o) => {
    ;(acc[o.library_id] ??= []).push(o)
    return acc
  }, {})

  const toggleLib = (id: string) => setOpenLibs(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div className="h-full overflow-y-auto">
      {mode === 'trace' && (
        <div className="px-3 py-2.5 border-b border-zinc-100 bg-amber-50/50">
          <p className="text-[11px] text-amber-800 leading-relaxed flex items-start gap-1.5">
            <Crosshair className="w-3.5 h-3.5 shrink-0 mt-px" />
            点目标 → 高亮全书覆盖段落；点正文段落 → 反查其目标
          </p>
        </div>
      )}
      {libraries.map(lib => {
        const libObjs = byLib[lib.id] || []
        if (mode === 'trace' && !libObjs.some(o => coverage[o.id])) {
          // trace 模式只展示本书涉及的库，但仍显示未覆盖目标供缺口感知
        }
        const libSelected = libObjs.filter(o => selectedIds.includes(o.id))
        const allSelected = libObjs.length > 0 && libSelected.length === libObjs.length
        const open = openLibs.has(lib.id)
        return (
          <div key={lib.id} className="border-b border-zinc-100 last:border-0">
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50">
              <button className="flex-1 flex items-center gap-1.5 text-left min-w-0" onClick={() => toggleLib(lib.id)}>
                {open ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
                <span className="text-[13px] font-medium text-zinc-700 truncate">{lib.name}</span>
              </button>
              {mode === 'select' && onSelectAll && (
                <>
                  <button type="button" className="text-[11px] text-blue-600 hover:underline shrink-0"
                    onClick={() => onSelectAll(allSelected ? selectedIds.filter(id => !libObjs.find(o => o.id === id)) : [...new Set([...selectedIds, ...libObjs.map(o => o.id)])])}>
                    {allSelected ? '清空' : '全选'}
                  </button>
                  <span className="text-[11px] text-zinc-400 shrink-0">{libSelected.length}/{libObjs.length}</span>
                </>
              )}
            </div>
            {open && (
              <ul className="pb-1">
                {libObjs.map(o => mode === 'select'
                  ? <SelectRow key={o.id} o={o} selected={selectedIds.includes(o.id)} onToggle={onToggle} />
                  : <TraceRow key={o.id} o={o}
                      count={coverage[o.id] ?? 0}
                      active={highlightObjectiveId === o.id}
                      reverseHit={reverseHighlightIds.includes(o.id)}
                      onTrace={onTrace} />
                )}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SelectRow({ o, selected, onToggle }: { o: LearningObjective; selected: boolean; onToggle?: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onToggle?.(o.id)}
        className="w-full flex items-start gap-2 pl-8 pr-3 py-1.5 text-left hover:bg-zinc-50">
        {selected
          ? <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          : <Circle className="w-4 h-4 text-zinc-300 mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] text-zinc-700 leading-snug">{o.description}</p>
          <span className={`inline-block mt-1 text-[10px] px-1.5 py-px rounded ${DIMENSION_COLORS[o.cognitive_dimension] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {DIMENSION_LABELS[o.cognitive_dimension] ?? o.cognitive_dimension}
          </span>
        </div>
      </button>
    </li>
  )
}

function TraceRow({ o, count, active, reverseHit, onTrace }: {
  o: LearningObjective; count: number; active: boolean; reverseHit: boolean
  onTrace?: (id: string | null) => void
}) {
  return (
    <li>
      <button type="button" onClick={() => onTrace?.(active ? null : o.id)}
        className={`w-full flex items-start gap-2 pl-4 pr-3 py-2 text-left transition-colors border-l-2 ${
          active ? 'bg-blue-50 border-blue-500'
            : reverseHit ? 'bg-amber-50 border-amber-400'
              : 'border-transparent hover:bg-zinc-50'
        }`}>
        <Target className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${active ? 'text-blue-600' : reverseHit ? 'text-amber-500' : count ? 'text-zinc-400' : 'text-zinc-200'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-[12.5px] leading-snug ${count ? 'text-zinc-700' : 'text-zinc-400'}`}>{o.description}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-[10px] px-1.5 py-px rounded ${DIMENSION_COLORS[o.cognitive_dimension] ?? 'bg-zinc-100 text-zinc-600'}`}>
              {DIMENSION_LABELS[o.cognitive_dimension] ?? o.cognitive_dimension}
            </span>
            <span className={`text-[10px] ${count ? 'text-zinc-400' : 'text-red-300'}`}>
              {count ? `${count} 段覆盖` : '未覆盖'}
            </span>
          </div>
        </div>
      </button>
    </li>
  )
}
