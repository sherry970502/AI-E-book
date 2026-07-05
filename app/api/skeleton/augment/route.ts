import { NextRequest, NextResponse } from 'next/server'
import { getChapters, getSections, createSection, getSectionsByChapter, updateChapter } from '@/lib/db/queries/books'
import { getObjectivesByIds } from '@/lib/db/queries/objectives'
import { randomUUID } from 'crypto'

/**
 * 目标增补落点：为纲要尚未覆盖的新增目标创建待生成小节（轮流分配到各章末尾）。
 * P0 为确定性分配；接入 API key 后可升级为 AI 规划最优落点。
 */
export async function POST(req: NextRequest) {
  const { bookId, objectiveIds } = await req.json()
  const chapters = getChapters(bookId)
  if (!chapters.length) return NextResponse.json({ error: '尚无纲要' }, { status: 400 })

  const covered = new Set(getSections(bookId).flatMap(s => s.objective_ids))
  const toAdd = getObjectivesByIds(objectiveIds ?? []).filter(o => !covered.has(o.id))

  const created: string[] = []
  toAdd.forEach((obj, i) => {
    const ch = chapters[(chapters.length - 1 + i) % chapters.length]  // 从末章起轮流
    const chIdx = chapters.findIndex(c => c.id === ch.id) + 1
    const secs = getSectionsByChapter(ch.id)
    const title = `${chIdx}.${secs.length + 1} ${obj.description.slice(0, 16)}${obj.description.length > 16 ? '…' : ''}`
    createSection({
      id: randomUUID(),
      chapter_id: ch.id,
      book_id: bookId,
      order_index: secs.length,
      title,
      content: null,
      status: 'pending',
      objective_ids: [obj.id],
      page_number: null,
      brief: `目标增补新增小节，覆盖：${obj.description}`,
    })
    updateChapter(ch.id, { objective_ids: [...new Set([...ch.objective_ids, obj.id])] })
    created.push(title)
  })

  return NextResponse.json({ created })
}
