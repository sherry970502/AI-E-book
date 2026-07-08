import { NextRequest, NextResponse } from 'next/server'
import { getBook, getChapters, getSectionsByChapter } from '@/lib/db/queries/books'
import { getParagraphs } from '@/lib/db/queries/paragraphs'
import { getIllustrationsBySection } from '@/lib/db/queries/illustrations'
import { getQuestions } from '@/lib/db/queries/questions'
import { getObjectivesByIds } from '@/lib/db/queries/objectives'
import { getDb } from '@/lib/db'
import type { BookCover } from '@/types'

/**
 * 全书导出数据：一次性组装成打印视图需要的嵌套结构
 * book + cover + chapters[ sections[ paragraphs / illustrations / questions ] ]
 * 供 /books/[id]/print 打印为 PDF。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const book = getBook(id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const cover = (getDb().prepare(`SELECT * FROM covers WHERE book_id = ?`).get(id) as BookCover | undefined) ?? null

  const chapters = getChapters(id).map(ch => {
    const sections = getSectionsByChapter(ch.id).map(s => ({
      ...s,
      paragraphs: getParagraphs(s.id),
      illustrations: getIllustrationsBySection(s.id),
      questions: getQuestions(s.id),
      objectives: getObjectivesByIds(s.objective_ids),
    }))
    return { ...ch, sections }
  })

  return NextResponse.json({ book, cover, chapters })
}
