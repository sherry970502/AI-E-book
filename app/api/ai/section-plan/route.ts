import { NextRequest, NextResponse } from 'next/server'
import { callClaude, parseJSON } from '@/lib/ai'
import { getBook, getSection, getChapters, updateSectionBlockPlan } from '@/lib/db/queries/books'
import { getObjectivesByIds } from '@/lib/db/queries/objectives'
import { getAdaptationPlan } from '@/lib/db/queries/adaptation'
import { randomUUID } from 'crypto'
import type { ContentBlock, BlockType } from '@/types'
import { getGenre } from '@/lib/genres'

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
      [{ role: 'user', content: `为教材小节设计正文脉络（教学颗粒序列）。

小节：${section.title}（所属：${chapter?.title ?? ''}）
教学要点（老师已确认）：${section.brief || '无'}
学习目标：${objectives.map(o => `${o.description}（${o.cognitive_dimension}）`).join('；') || '无'}
受众：${book.audience_grade}；风格：${book.style}${plan?.pedagogy ? `；教学法偏好：${plan.pedagogy}` : ''}
${getGenre(book.genre).planHint ? `\n【体裁】本书体裁为「${getGenre(book.genre).label}」：${getGenre(book.genre).planHint}\n` : ''}
可用颗粒类型：intro(情境导入) concept(核心概念) callout(重点说明) example(典型例题) figure(配图示意) summary(小结) exercise(互动练习)

要求：5-8 个颗粒组成合理的教学递进；每个颗粒的 desc 一句话写清具体承载什么（结合教学要点，不写空话）；同类型可出现多次（如两道例题）。

只输出 JSON 数组：[{"type":"intro","desc":"..."},...]` }],
      '你是教学设计专家，把小节内容规划为教学颗粒序列。只输出 JSON。',
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
