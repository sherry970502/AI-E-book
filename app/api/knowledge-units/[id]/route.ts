import { NextRequest, NextResponse } from 'next/server'
import { updateKnowledgeUnitIntent } from '@/lib/db/queries/skeletons'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { intent, objectiveIds } = await req.json()
  updateKnowledgeUnitIntent(id, intent, objectiveIds ?? [])
  return NextResponse.json({ ok: true })
}
