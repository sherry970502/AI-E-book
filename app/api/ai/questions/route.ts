import { NextRequest, NextResponse } from 'next/server'
import { callClaude, parseJSON } from '@/lib/ai'
import { buildQuestionsSystem, buildQuestionsPrompt } from '@/lib/prompts/questions'
import { getSection } from '@/lib/db/queries/books'
import { getObjectivesByIds } from '@/lib/db/queries/objectives'
import { batchCreateQuestions, deleteQuestionsBySection } from '@/lib/db/queries/questions'
import { randomUUID } from 'crypto'
import type { Question } from '@/types'

/**
 * 出题：小节整体（3-5题）或选中段落定向出题（paragraphText）。
 * 每题标注考察的 objective_ids（验收：题目按目标定向生成）。
 */
export async function POST(req: NextRequest) {
  const { sectionId, count = 4, paragraphText, append = false } = await req.json()

  const section = getSection(sectionId)
  if (!section) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!section.content) return NextResponse.json({ error: 'section has no content' }, { status: 400 })

  const objectives = getObjectivesByIds(section.objective_ids)
  const n = Math.max(3, Math.min(5, count))

  let result: { questions: Array<Omit<Question, 'id' | 'section_id'>> }

  if (!process.env.ANTHROPIC_API_KEY) {
    const scopeNote = paragraphText ? `针对选中段落「${String(paragraphText).slice(0, 24)}…」` : `关于「${section.title}」`
    result = {
      questions: Array.from({ length: paragraphText ? 2 : n }, (_, i) => ({
        stem: `（Mock）${scopeNote}的第 ${i + 1} 题：下列关于核心概念的说法，正确的是？`,
        options: [
          { label: 'A', text: '对应关系满足确定性与唯一性', is_correct: true },
          { label: 'B', text: '对应即相等', is_correct: false },
          { label: 'C', text: '唯一性可以省略', is_correct: false },
          { label: 'D', text: '以上都不对', is_correct: false },
        ],
        explanation: '（Mock）正文「核心概念」一节明确指出定义包含确定性与唯一性两个要件，B 混淆了对应与相等，C 违反定义。答案 A。',
        objective_ids: objectives.slice(0, 2).map(o => o.id),
      })),
    }
  } else {
    const raw = await callClaude(
      [{ role: 'user', content: buildQuestionsPrompt(section.title, section.content, objectives, paragraphText ? 2 : n, paragraphText) }],
      buildQuestionsSystem(),
      4000
    )
    result = parseJSON<{ questions: Array<Omit<Question, 'id' | 'section_id'>> }>(raw, { questions: [] })
  }

  if (!append) deleteQuestionsBySection(sectionId)
  const questions: Question[] = result.questions.map(q => ({
    ...q,
    objective_ids: q.objective_ids ?? [],
    id: randomUUID(),
    section_id: sectionId,
  }))
  batchCreateQuestions(questions)

  return NextResponse.json(questions)
}
