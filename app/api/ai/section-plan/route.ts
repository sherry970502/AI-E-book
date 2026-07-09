import { NextRequest, NextResponse } from 'next/server'
import { callClaude, parseJSON } from '@/lib/ai'
import { getBook, getSection, getChapters, updateSectionBlockPlan } from '@/lib/db/queries/books'
import { getObjectivesByIds } from '@/lib/db/queries/objectives'
import { getAdaptationPlan } from '@/lib/db/queries/adaptation'
import { randomUUID } from 'crypto'
import type { ContentBlock, BlockType } from '@/types'
import { buildSectionPlanSystem, buildSectionPlanPrompt } from '@/lib/prompts/section-plan'

const VALID_TYPES = new Set<string>(['intro', 'concept', 'callout', 'example', 'figure', 'summary', 'exercise'])

/** AI 设计正文脉络：教学颗粒序列，供老师逐颗粒确认去留 */
export async function POST(req: NextRequest) {
  const { sectionId } = await req.json()
  const section = getSection(sectionId)
  if (!section) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const book = getBook(section.book_id)!
  const chapter = getChapters(section.book_id).find(c => c.id === section.chapter_id)
  const objectives = getObjectivesByIds(section.objective_ids)
  const plan = book.source === 'adaptation' ? getAdaptationPlan(section.book_id) : null

  let blocks: ContentBlock[]

  if (!process.env.ANTHROPIC_API_KEY) {
    // Mock：从教学要点推导一条标准教学脉络
    const briefHint = section.brief ? section.brief.slice(0, 24) : section.title
    blocks = [
      { type: 'intro', desc: `以真实情境切入（${briefHint}…），唤起先验经验` },
      { type: 'concept', desc: '给出核心概念的严格定义，拆解构成要件' },
      { type: 'callout', desc: '重点说明：常见误区辨析与关键结论提示' },
      { type: 'example', desc: '典型例题一道，按"审题→建模→求解→回顾"示范' },
      { type: 'figure', desc: '概念关系示意图一张，辅助直觉理解' },
      { type: 'summary', desc: '小结：回扣本节学习目标，预告下一节' },
      { type: 'exercise', desc: '随堂练习 3-4 道选择题（按学习目标定向出题）' },
    ].map(b => ({ ...b, id: randomUUID(), enabled: b.type === 'figure' ? section.elements.illustration : b.type === 'exercise' ? section.elements.exercise : true } as ContentBlock))
  } else {
    const raw = await callClaude(
      [{ role: 'user', content: buildSectionPlanPrompt(section, chapter?.title ?? '', objectives, book, plan?.pedagogy) }],
      buildSectionPlanSystem(),
      2000
    )
    const parsed = parseJSON<{ type: string; desc: string }[]>(raw, [])
    blocks = parsed
      .filter(b => VALID_TYPES.has(b.type) && b.desc)
      .map(b => ({ id: randomUUID(), type: b.type as BlockType, desc: b.desc, enabled: true }))
    if (!blocks.length) return NextResponse.json({ error: '脉络设计失败，请重试' }, { status: 500 })
  }

  updateSectionBlockPlan(sectionId, blocks)
  return NextResponse.json({ blocks })
}
