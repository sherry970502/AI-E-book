import { NextRequest, NextResponse } from 'next/server'
import { getBook, getChapters, getSections, deleteBook } from '@/lib/db/queries/books'
import { getSkeleton, getKnowledgeUnits } from '@/lib/db/queries/skeletons'
import { getDb } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const book = getBook(id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const chapters = getChapters(id)
  const sections = getSections(id)
  const skeleton = getSkeleton(id)
  const knowledgeUnits = skeleton ? getKnowledgeUnits(skeleton.id) : []

  // 目标覆盖统计 + 段落来源统计（二创忠实度审计：全书 objectiveId→段落数、source_tag→段落数）
  const rows = getDb().prepare(`
    SELECT p.objective_ids, p.source_tag FROM paragraphs p
    JOIN sections s ON s.id = p.section_id
    WHERE s.book_id = ?
  `).all(id) as { objective_ids: string; source_tag: string | null }[]
  const coverage: Record<string, number> = {}
  const sourceStats: Record<string, number> = {}
  for (const r of rows) {
    for (const oid of JSON.parse(r.objective_ids || '[]') as string[]) {
      coverage[oid] = (coverage[oid] ?? 0) + 1
    }
    if (r.source_tag) sourceStats[r.source_tag] = (sourceStats[r.source_tag] ?? 0) + 1
  }

  return NextResponse.json({ book, chapters, sections, skeleton, knowledgeUnits, coverage, sourceStats })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  deleteBook(id)
  return NextResponse.json({ ok: true })
}
