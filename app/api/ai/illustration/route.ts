import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/ai'
import { buildIllustrationSystem, buildIllustrationPrompt } from '@/lib/prompts/illustration'
import { createIllustration } from '@/lib/db/queries/illustrations'
import { figureNumberFor } from '@/lib/figure-number'
import { randomUUID } from 'crypto'

function buildMockSvg(paragraphText: string, figureNumber: string): string {
  const title = paragraphText.slice(0, 30).replace(/[<>&"]/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320" style="background:#f8fafc;border-radius:8px">
  <rect x="0" y="0" width="600" height="320" fill="#f8fafc" rx="8"/>
  <rect x="40" y="40" width="520" height="180" fill="#e2e8f0" rx="6"/>
  <circle cx="180" cy="130" r="60" fill="#93c5fd" opacity="0.7"/>
  <rect x="280" y="80" width="100" height="100" fill="#6ee7b7" opacity="0.7" rx="4"/>
  <polygon points="440,170 490,80 540,170" fill="#fca5a5" opacity="0.7"/>
  <line x1="180" y1="130" x2="330" y2="130" stroke="#64748b" stroke-width="2" stroke-dasharray="6,3"/>
  <line x1="330" y1="130" x2="490" y2="130" stroke="#64748b" stroke-width="2" stroke-dasharray="6,3"/>
  <text x="180" y="200" text-anchor="middle" font-size="11" fill="#475569">概念A</text>
  <text x="330" y="200" text-anchor="middle" font-size="11" fill="#475569">概念B</text>
  <text x="490" y="200" text-anchor="middle" font-size="11" fill="#475569">概念C</text>
  <text x="300" y="270" text-anchor="middle" font-size="12" fill="#64748b">${figureNumber}　${title}…</text>
</svg>`
}

export async function POST(req: NextRequest) {
  const { sectionId, paragraphId, paragraphText, sectionTitle } = await req.json()

  const figNum = figureNumberFor(sectionId)

  let svgContent: string

  if (!process.env.ANTHROPIC_API_KEY) {
    svgContent = buildMockSvg(paragraphText ?? sectionTitle, figNum)
  } else {
    const raw = await callClaude(
      [{ role: 'user', content: buildIllustrationPrompt(paragraphText, sectionTitle, figNum) }],
      buildIllustrationSystem(),
      4000
    )
    // Extract SVG from response
    const svgMatch = raw.match(/<svg[\s\S]*?<\/svg>/i)
    svgContent = svgMatch ? svgMatch[0] : buildMockSvg(paragraphText, figNum)
  }

  const illustration = createIllustration({
    id: randomUUID(),
    section_id: sectionId,
    paragraph_id: paragraphId ?? null,
    caption: `${sectionTitle} 示意图`,
    figure_number: figNum,
    source: process.env.ANTHROPIC_API_KEY ? 'ai-svg' : 'ai-svg',
    url: null,
    svg_content: svgContent,
  })

  return NextResponse.json(illustration)
}
