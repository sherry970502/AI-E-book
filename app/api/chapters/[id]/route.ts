import { NextRequest, NextResponse } from 'next/server'
import { getSectionsByChapter, updateChapter, deleteChapter, normalizeChapterOrder, createSection } from '@/lib/db/queries/books'
import { getDb } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return NextResponse.json(getSectionsByChapter(id))
}

/** 大纲直接编辑：改章标题/概述/关联目标 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  updateChapter(id, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const row = getDb().prepare(`SELECT book_id FROM chapters WHERE id = ?`).get(id) as { book_id: string } | undefined
  deleteChapter(id)
  if (row) normalizeChapterOrder(row.book_id)
  return NextResponse.json({ ok: true })
}

/** 在本章末尾直接新增小节 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { title } = await req.json()
  const row = getDb().prepare(`SELECT book_id FROM chapters WHERE id = ?`).get(id) as { book_id: string } | undefined
  if (!row) return NextResponse.json({ error: 'chapter not found' }, { status: 404 })
  const secs = getSectionsByChapter(id)
  const section = createSection({
    id: randomUUID(), chapter_id: id, book_id: row.book_id,
    order_index: secs.length, title: title || '新小节',
    content: null, status: 'pending', objective_ids: [], page_number: null,
  })
  return NextResponse.json(section)
}
