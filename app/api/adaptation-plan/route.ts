import { NextRequest, NextResponse } from 'next/server'
import { getAdaptationPlan, upsertAdaptationPlan } from '@/lib/db/queries/adaptation'
import { callClaude, parseJSON } from '@/lib/ai'
import { buildIntentParseSystem, buildIntentParsePrompt } from '@/lib/prompts/adaptation'

export async function GET(req: NextRequest) {
  const bookId = req.nextUrl.searchParams.get('book_id')
  if (!bookId) return NextResponse.json({ error: 'book_id required' }, { status: 400 })
  return NextResponse.json(getAdaptationPlan(bookId) ?? {
    book_id: bookId, audience_note: '', pedagogy: '', free_intent: '', structured_intent: [], confirmed: 0,
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  if (!body.book_id) return NextResponse.json({ error: 'book_id required' }, { status: 400 })

  // 自由意图 → 结构化改编指令（回显确认，需求 4.3.5）
  let structured: string[] = body.structured_intent ?? []
  if (body.free_intent?.trim() && body.parse_intent) {
    if (!process.env.ANTHROPIC_API_KEY) {
      structured = body.free_intent
        .split(/[。；;\n]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 3)
        .map((s: string, i: number) => `指令${i + 1}：${s}（Mock 解析：将作用于相关章节的生成策略）`)
    } else {
      const raw = await callClaude(
        [{ role: 'user', content: buildIntentParsePrompt(body.free_intent) }],
        buildIntentParseSystem(),
        1500
      )
      structured = parseJSON<string[]>(raw, [])
    }
  }

  upsertAdaptationPlan({
    book_id: body.book_id,
    audience_note: body.audience_note ?? '',
    pedagogy: body.pedagogy ?? '',
    free_intent: body.free_intent ?? '',
    structured_intent: structured,
    confirmed: body.confirmed ? 1 : 0,
  })
  return NextResponse.json(getAdaptationPlan(body.book_id))
}
