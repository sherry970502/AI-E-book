import { NextRequest, NextResponse } from 'next/server'
import { updateObjective, deleteObjective, getObjective } from '@/lib/db/queries/objectives'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!getObjective(id)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const body = await req.json()
  updateObjective(id, body)
  return NextResponse.json(getObjective(id))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  deleteObjective(id)
  return NextResponse.json({ ok: true })
}
