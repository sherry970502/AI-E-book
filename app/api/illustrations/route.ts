import { NextRequest, NextResponse } from 'next/server'
import { getIllustrationsBySection, deleteIllustration, updateIllustrationCaption, updateIllustrationParagraph } from '@/lib/db/queries/illustrations'

export function GET(req: NextRequest) {
  const sectionId = req.nextUrl.searchParams.get('section_id')
  if (!sectionId) return NextResponse.json([])
  return NextResponse.json(getIllustrationsBySection(sectionId))
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteIllustration(id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { id, caption, paragraph_id } = await req.json()
  if (caption !== undefined) updateIllustrationCaption(id, caption)
  if (paragraph_id !== undefined) updateIllustrationParagraph(id, paragraph_id)
  return NextResponse.json({ ok: true })
}
