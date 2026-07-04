'use client'
import { useState } from 'react'
import { Grid3X3, List } from 'lucide-react'
import type { AlignmentEntry, LearningObjective, KnowledgeUnit } from '@/types'

interface Props {
  alignments: AlignmentEntry[]
  objectives: LearningObjective[]
  units: KnowledgeUnit[]
}

const STATUS_META: Record<string, { label: string; icon: string; color: string; cell: string }> = {
  covered:    { label: '已覆盖', icon: '✅', color: 'bg-green-100 text-green-800', cell: 'bg-green-400' },
  gap:        { label: '缺口',   icon: '⚠️', color: 'bg-red-100 text-red-700',     cell: 'bg-red-300' },
  redundant:  { label: '冗余候选', icon: '🗑', color: 'bg-yellow-100 text-yellow-800', cell: 'bg-yellow-300' },
  misaligned: { label: '错位',   icon: '🔀', color: 'bg-orange-100 text-orange-800', cell: 'bg-orange-300' },
}

/** 覆盖度矩阵报告：矩阵 + 列表双视图（需求 4.2，意图注入前的第一屏）*/
export function AlignmentMatrix({ alignments, objectives, units }: Props) {
  const [view, setView] = useState<'matrix' | 'list'>('matrix')
  const objMap = Object.fromEntries(objectives.map(o => [o.id, o]))
  const unitMap = Object.fromEntries(units.map(u => [u.id, u]))

  const summary = { covered: 0, gap: 0, redundant: 0, misaligned: 0 }
  for (const a of alignments) summary[a.status as keyof typeof summary]++

  // 矩阵列 = 原书章；单元格 = 该目标在该章是否有命中单元
  const chapterTitles = [...new Set(units.map(u => u.chapter_title))]
  // 不对应任何目标的单元 = 冗余候选
  const hitUnitIds = new Set(alignments.flatMap(a => a.unit_ids ?? []))
  const redundantUnits = units.filter(u => !hitUnitIds.has(u.id))

  return (
    <div className="space-y-4">
      {/* 汇总 + 视图切换 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(summary).map(([k, v]) => (
            <span key={k} className={`px-2.5 py-1 rounded-full text-[11.5px] font-medium ${STATUS_META[k].color}`}>
              {STATUS_META[k].icon} {STATUS_META[k].label} {v}
            </span>
          ))}
          {redundantUnits.length > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-yellow-100 text-yellow-800">
              🗑 可裁剪单元 {redundantUnits.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg p-0.5">
          <button onClick={() => setView('matrix')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] transition-colors ${view === 'matrix' ? 'bg-white shadow-sm text-zinc-800 font-medium' : 'text-zinc-500'}`}>
            <Grid3X3 className="w-3 h-3" />矩阵
          </button>
          <button onClick={() => setView('list')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] transition-colors ${view === 'list' ? 'bg-white shadow-sm text-zinc-800 font-medium' : 'text-zinc-500'}`}>
            <List className="w-3 h-3" />列表
          </button>
        </div>
      </div>

      {view === 'matrix' ? (
        /* ── 矩阵视图：目标 × 原书章 ── */
        <div className="overflow-x-auto border border-zinc-200 rounded-xl">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-zinc-50">
                <th className="text-left px-3 py-2 font-medium text-zinc-500 min-w-[220px]">学习目标</th>
                {chapterTitles.map(ct => (
                  <th key={ct} className="px-2 py-2 font-medium text-zinc-500 text-center min-w-[80px]">
                    <span className="line-clamp-2 text-[11px]">{ct.replace(/^第[一二三四五六七八九十\d]+章\s*/, '') || ct}</span>
                  </th>
                ))}
                <th className="px-2 py-2 font-medium text-zinc-500 text-center w-20">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {alignments.map(a => {
                const obj = objMap[a.objective_id]
                const meta = STATUS_META[a.status] ?? STATUS_META.gap
                const aUnits = (a.unit_ids ?? []).map(id => unitMap[id]).filter(Boolean)
                return (
                  <tr key={a.objective_id} className="hover:bg-zinc-50/60">
                    <td className="px-3 py-2 text-zinc-700 leading-snug">{obj?.description ?? a.objective_id}</td>
                    {chapterTitles.map(ct => {
                      const hits = aUnits.filter(u => u.chapter_title === ct)
                      return (
                        <td key={ct} className="px-2 py-2 text-center">
                          {hits.length > 0 ? (
                            <span title={hits.map(u => u.core_concept).join('、')}
                              className={`inline-block w-5 h-5 rounded ${meta.cell} text-white text-[10px] leading-5 font-bold`}>
                              {hits.length}
                            </span>
                          ) : (
                            <span className="inline-block w-5 h-5 rounded bg-zinc-100" />
                          )}
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${meta.color}`}>{meta.icon}{meta.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── 列表视图 ── */
        <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
          {alignments.map(a => {
            const obj = objMap[a.objective_id]
            const meta = STATUS_META[a.status] ?? STATUS_META.gap
            const aUnits = (a.unit_ids ?? []).map(id => unitMap[id]).filter(Boolean)
            return (
              <div key={a.objective_id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-0.5 shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${meta.color}`}>{meta.icon} {meta.label}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-zinc-700 font-medium leading-snug">{obj?.description ?? a.objective_id}</p>
                  {aUnits.length > 0 && (
                    <p className="text-[11px] text-zinc-400 mt-1">命中单元：{aUnits.map(u => u.core_concept).join('、')}</p>
                  )}
                  {a.notes && <p className="text-[11px] text-zinc-500 mt-0.5 italic">{a.notes}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 冗余候选（可裁剪项）*/}
      {redundantUnits.length > 0 && (
        <div className="border border-yellow-200 bg-yellow-50/50 rounded-xl px-4 py-3">
          <p className="text-[12px] font-semibold text-yellow-800 mb-1.5">🗑 冗余候选——原书中不对应任何所选目标的内容（可在下一步标记删除）</p>
          <div className="flex flex-wrap gap-1.5">
            {redundantUnits.map(u => (
              <span key={u.id} className="text-[11px] bg-white border border-yellow-200 text-yellow-800 rounded-md px-2 py-0.5">
                {u.chapter_title.replace(/^第[一二三四五六七八九十\d]+章\s*/, '')} / {u.core_concept}
              </span>
            ))}
          </div>
        </div>
      )}
      {alignments.length === 0 && (
        <p className="text-center text-sm text-zinc-400 py-8">暂无对齐数据</p>
      )}
    </div>
  )
}
