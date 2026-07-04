import { NextRequest, NextResponse } from 'next/server'
import { listLibraries, listObjectives, createObjective, createLibrary } from '@/lib/db/queries/objectives'
import { randomUUID } from 'crypto'

export function GET(req: NextRequest) {
  const libraryId = req.nextUrl.searchParams.get('library_id') ?? undefined
  const libraries = listLibraries()
  const objectives = listObjectives(libraryId)
  return NextResponse.json({ libraries, objectives })
}

/** 新增学习目标（body 带 library_name 时自动建库） */
export async function POST(req: NextRequest) {
  const body = await req.json()
  let libraryId = body.library_id
  if (!libraryId && body.library_name) {
    libraryId = randomUUID()
    createLibrary({ id: libraryId, name: body.library_name, subject: body.subject ?? '', grade_level: body.grade_level ?? '' })
  }
  if (!libraryId || !body.description?.trim()) {
    return NextResponse.json({ error: 'library_id/library_name 与 description 必填' }, { status: 400 })
  }
  const objective = createObjective({
    id: randomUUID(),
    library_id: libraryId,
    subject: body.subject ?? '',
    grade_level: body.grade_level ?? '',
    description: body.description.trim(),
    cognitive_dimension: body.cognitive_dimension ?? 'understand',
    tags: body.tags ?? [],
  })
  return NextResponse.json(objective)
}
