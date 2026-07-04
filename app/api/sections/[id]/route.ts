import { NextRequest, NextResponse } from 'next/server'
import { getSection, updateSectionContent, updateSectionStatus, updateSection, deleteSection, normalizeSectionOrder, updateSectionElements, updateSectionBlockPlan } from '@/lib/db/queries/books'
import { getQuestions } from '@/lib/db/queries/questions'
import { getParagraphs } from '@/lib/db/queries/paragraphs'
import { getIllustrationsBySection } from '@/lib/db/queries/illustrations'
import { getObjectivesByIds } from '@/lib/db/queries/objectives'
import { structureSectionContent } from '@/lib/paragraph-structurer'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const section = getSection(id)
  if (!section) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({
    section,
    paragraphs: getParagraphs(id),
    questions: getQuestions(id),
    illustrations: getIllustrationsBySection(id),
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const section = getSection(id)
  if (!section) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const body = await req.json()
  if (body.content !== undefined) {
    updateSectionContent(id, body.content, body.status ?? 'completed')
    // 手动编辑后重建段落结构（无标记 → 空行切块 + 目标轮转兜底）
    const objectives = getObjectivesByIds(section.objective_ids)
    structureSectionContent(id, body.content, objectives, 'teacher-specified')
  } else if (body.title !== undefined || body.objective_ids !== undefined || body.brief !== undefined) {
    updateSection(id, { title: body.title, objective_ids: body.objective_ids, brief: body.brief })
  } else if (body.block_plan !== undefined) {
    updateSectionBlockPlan(id, body.block_plan)
  } else if (body.elements !== undefined) {
    updateSectionElements(id, body.elements)
  } else if (body.status !== undefined) {
    updateSectionStatus(id, body.status)
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const section = getSection(id)
  if (!section) return NextResponse.json({ error: 'not found' }, { status: 404 })
  deleteSection(id)
  normalizeSectionOrder(section.chapter_id)
  return NextResponse.json({ ok: true })
}
