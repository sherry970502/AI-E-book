import { NextRequest, NextResponse } from 'next/server'
import { getSkeleton, getKnowledgeUnits } from '@/lib/db/queries/skeletons'
import { getChapters, getSections, getSectionsByChapter, deleteSection, normalizeSectionOrder } from '@/lib/db/queries/books'
import { materializeUnitSection, renumberChapterSections } from '@/lib/route-b/materialize'

/**
 * 二创「删除↔小节」联动：把已物化的原书小节同步到各知识单元的当前处置（intent）。
 * - 单元标为「删除」→ 移除它物化出的小节（不再进新书目录/不再生成正文）
 * - 单元改回「保留/重写」→ 若其小节已被移除则重新物化恢复
 * 以 section.source_unit_id 为准，未被改动的小节（含老师在纲要里编辑过的要点/顺序）原样保留。
 * 目标增补小节（source_unit_id 为空）不受影响。
 */
export async function POST(req: NextRequest) {
  const { bookId } = await req.json()

  const skeleton = getSkeleton(bookId)
  if (!skeleton) return NextResponse.json({ error: '尚未解析原书' }, { status: 400 })
  const units = getKnowledgeUnits(skeleton.id)
  const chapters = getChapters(bookId)
  const sections = getSections(bookId)

  const secByUnit = new Map(sections.filter(s => s.source_unit_id).map(s => [s.source_unit_id, s]))
  const removed: string[] = []
  const restored: string[] = []
  const affected = new Set<string>()

  for (const u of units) {
    const existing = secByUnit.get(u.id)
    const deleted = u.intent === 'delete'
    if (deleted && existing) {
      deleteSection(existing.id)
      removed.push(existing.title)
      affected.add(existing.chapter_id)
    } else if (!deleted && !existing) {
      // 恢复：materialize 以 chapter_title 建章，据此定位本单元所属章
      const chapter = chapters.find(c => c.title === u.chapter_title)
      if (!chapter) continue
      const chapterNumber = chapters.findIndex(c => c.id === chapter.id) + 1
      const secs = getSectionsByChapter(chapter.id)
      materializeUnitSection(bookId, chapter, u, secs.length, chapterNumber, secs.length + 1)
      restored.push(u.section_title || u.core_concept)
      affected.add(chapter.id)
    }
  }

  affected.forEach(cid => {
    normalizeSectionOrder(cid)
    renumberChapterSections(cid, chapters.findIndex(c => c.id === cid) + 1)
  })
  return NextResponse.json({ removed, restored })
}
