import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getBook } from '@/lib/db/queries/books'
import { callClaude } from '@/lib/ai'
import { buildCoverSystem, buildCoverPrompt } from '@/lib/prompts/cover'
import type { BookCover } from '@/types'

function getCover(bookId: string): BookCover {
  const row = getDb().prepare(`SELECT * FROM covers WHERE book_id = ?`).get(bookId) as BookCover | undefined
  return row ?? { book_id: bookId, subtitle: '', author_line: '', palette: 'indigo', svg_content: null }
}

export async function GET(req: NextRequest) {
  const bookId = req.nextUrl.searchParams.get('book_id')
  if (!bookId) return NextResponse.json({ error: 'book_id required' }, { status: 400 })
  return NextResponse.json(getCover(bookId))
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  if (!body.book_id) return NextResponse.json({ error: 'book_id required' }, { status: 400 })

  let svg = body.svg_content ?? getCover(body.book_id).svg_content

  // AI 生成封面主视觉（SVG 矢量，失败/无 key 时用主题降级图形）
  if (body.generate_art) {
    const book = getBook(body.book_id)
    if (process.env.ANTHROPIC_API_KEY && book) {
      const raw = await callClaude(
        [{ role: 'user', content: buildCoverPrompt(book) }],
        buildCoverSystem(),
        4000
      )
      const m = raw.match(/<svg[\s\S]*?<\/svg>/i)
      if (m) svg = m[0]
    }
    if (!svg) svg = buildMockCoverArt(body.palette ?? 'indigo')
  }

  getDb().prepare(`
    INSERT INTO covers (book_id, subtitle, author_line, palette, svg_content, updated_at)
    VALUES (?,?,?,?,?,datetime('now'))
    ON CONFLICT(book_id) DO UPDATE SET
      subtitle = excluded.subtitle, author_line = excluded.author_line,
      palette = excluded.palette, svg_content = excluded.svg_content, updated_at = datetime('now')
  `).run(body.book_id, body.subtitle ?? '', body.author_line ?? '', body.palette ?? 'indigo', svg)

  return NextResponse.json(getCover(body.book_id))
}

function buildMockCoverArt(palette: string): string {
  const colors: Record<string, string[]> = {
    indigo: ['#6366f1', '#a5b4fc', '#e0e7ff'],
    emerald: ['#10b981', '#6ee7b7', '#d1fae5'],
    amber: ['#f59e0b', '#fcd34d', '#fef3c7'],
    rose: ['#f43f5e', '#fda4af', '#ffe4e6'],
  }
  const [c1, c2, c3] = colors[palette] ?? colors.indigo
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <circle cx="290" cy="90" r="110" fill="${c3}"/>
  <circle cx="120" cy="200" r="80" fill="${c2}" opacity="0.85"/>
  <rect x="180" y="140" width="130" height="130" rx="18" fill="${c1}" opacity="0.9" transform="rotate(12 245 205)"/>
  <path d="M 40 80 Q 120 20 200 70 T 370 60" stroke="${c1}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="70" cy="70" r="9" fill="${c1}"/>
  <circle cx="340" cy="230" r="13" fill="${c2}"/>
</svg>`
}
