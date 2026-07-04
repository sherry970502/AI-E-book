import { NextRequest, NextResponse } from 'next/server'
import { createIllustration } from '@/lib/db/queries/illustrations'
import { figureNumberFor } from '@/lib/figure-number'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const sectionId = formData.get('sectionId') as string
  const sectionTitle = formData.get('sectionTitle') as string
  const paragraphId = (formData.get('paragraphId') as string) || null

  if (!file || !sectionId) {
    return NextResponse.json({ error: 'missing file or sectionId' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = file.type || 'image/png'
  const dataUrl = `data:${mimeType};base64,${base64}`

  const illus = createIllustration({
    id: randomUUID(),
    section_id: sectionId,
    paragraph_id: paragraphId,
    caption: `${sectionTitle} 插图`,
    figure_number: figureNumberFor(sectionId),
    source: 'uploaded' as const,
    url: dataUrl,
    svg_content: null,
  })

  return NextResponse.json(illus)
}
