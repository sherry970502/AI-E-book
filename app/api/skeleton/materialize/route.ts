import { NextRequest, NextResponse } from 'next/server'
import { getSkeleton, getKnowledgeUnits } from '@/lib/db/queries/skeletons'
import { getChapters, createChapter } from '@/lib/db/queries/books'
import { materializeUnitSection } from '@/lib/route-b/materialize'
import { randomUUID } from 'crypto'
import type { KnowledgeUnit } from '@/types'

/**
 * 二创纲要物化：把 AI 解构出的原书骨架直接铺成章节结构（不调 AI、不重新设计）。
 * 用户在这份「原书纲要」的基础上决定改什么——这就是二创的起点。
 * 章/节标题沿用原书；节的教学要点来自知识单元的定义；目标来自解析时的 AI 提取。
 */
export async function POST(req: NextRequest) {
  const { bookId } = await req.json()

  // 已物化过则跳过（幂等）
  const existing = getChapters(bookId)
  if (existing.length > 0) {
    return NextResponse.json({ materialized: false, chapterCount: existing.length })
  }

  const skeleton = getSkeleton(bookId)
  if (!skeleton) return NextResponse.json({ error: '尚未解析原书' }, { status: 400 })
  const units = getKnowledgeUnits(skeleton.id)
  if (!units.length) return NextResponse.json({ error: '骨架中没有知识单元' }, { status: 400 })

  // 按原书章组织
  const byChapter = new Map<string, KnowledgeUnit[]>()
  for (const u of units) {
    if (!byChapter.has(u.chapter_title)) byChapter.set(u.chapter_title, [])
    byChapter.get(u.chapter_title)!.push(u)
  }

  let chapterCount = 0
  let sectionCount = 0
  let ci = 0
  for (const [chTitle, chUnits] of byChapter) {
    ci++
    const chObjectiveIds = [...new Set(chUnits.flatMap(u => u.objective_ids))]
    const chapter = createChapter({
      id: randomUUID(),
      book_id: bookId,
      order_index: ci - 1,
      title: chTitle,
      summary: `原书本章包含：${chUnits.map(u => u.core_concept).join('、')}`,
      objective_ids: chObjectiveIds,
      status: 'pending',
    })
    chapterCount++
    chUnits.forEach((u, si) => {
      materializeUnitSection(bookId, chapter, u, si, ci, si + 1)
      sectionCount++
    })
  }

  return NextResponse.json({ materialized: true, chapterCount, sectionCount })
}
