import { NextRequest, NextResponse } from 'next/server'
import { callClaude, parseJSON } from '@/lib/ai'
import { buildParseBookSystem, buildParseBookPrompt } from '@/lib/prompts/parse'
import { createSkeleton, batchCreateKnowledgeUnits } from '@/lib/db/queries/skeletons'
import { createLibrary, createObjective } from '@/lib/db/queries/objectives'
import { getBook } from '@/lib/db/queries/books'
import { randomUUID } from 'crypto'
import type { LearningObjective } from '@/types'

interface ParseResult {
  chapters: { title: string; proportion?: string }[]
  units: {
    chapter_title: string; section_title: string; core_concept: string
    definition?: string; examples?: string[]; difficulty?: string
  }[]
  teaching_design: { sequence: string; exercise_distribution: string; difficulty_curve: string }
  style: { language: string; assumed_audience: string; layout_features: string }
  objectives?: { description: string; cognitive_dimension: string; unit_concepts?: string[] }[]
}

const MOCK_PARSE_RESULT: ParseResult = {
  chapters: [
    { title: '第一章 概念导入', proportion: '约25%' },
    { title: '第二章 核心内容', proportion: '约45%' },
    { title: '第三章 应用拓展', proportion: '约30%' },
  ],
  units: [
    { chapter_title: '第一章 概念导入', section_title: '基本概念', core_concept: '核心定义', definition: '从生活情境引入的核心概念严格定义', examples: ['售货机类比', '一卡通消费记录'], difficulty: 'easy' },
    { chapter_title: '第一章 概念导入', section_title: '基本性质', core_concept: '基本性质', definition: '概念的三条基本性质与推论', examples: ['性质验证例题'], difficulty: 'medium' },
    { chapter_title: '第二章 核心内容', section_title: '定理与证明', core_concept: '主要定理', definition: '核心定理的陈述与证明思路', examples: ['定理证明例', '反例辨析'], difficulty: 'hard' },
    { chapter_title: '第二章 核心内容', section_title: '计算方法', core_concept: '算法步骤', definition: '标准解题流程与常见错误', examples: ['标准计算例题'], difficulty: 'medium' },
    { chapter_title: '第三章 应用拓展', section_title: '实际应用', core_concept: '应用模型', definition: '知识在实际问题中的建模方式', examples: ['工程应用案例', '经济学应用'], difficulty: 'medium' },
    { chapter_title: '第三章 应用拓展', section_title: '拓展视野', core_concept: '前沿延伸', definition: '与后续课程的衔接和前沿方向', examples: ['科普阅读材料'], difficulty: 'easy' },
  ],
  teaching_design: {
    sequence: '定义先行，性质推导紧随，例题巩固，最后综合应用——典型的演绎式递进',
    exercise_distribution: '每节末 2-3 道练习，章末综合题组',
    difficulty_curve: '前缓后陡，第二章难度跃升明显',
  },
  style: {
    language: '学术严谨，术语密度高',
    assumed_audience: '有较好数学基础的大学低年级学生',
    layout_features: '双栏排版，定理加框，例题灰底',
  },
  objectives: [
    { description: '能准确陈述核心概念的定义并辨析常见误区', cognitive_dimension: 'understand', unit_concepts: ['核心定义'] },
    { description: '能运用基本性质对简单情形进行推导', cognitive_dimension: 'apply', unit_concepts: ['基本性质'] },
    { description: '能复述主要定理并理解其证明思路', cognitive_dimension: 'understand', unit_concepts: ['主要定理'] },
    { description: '能按标准流程完成典型计算并识别常见错误', cognitive_dimension: 'apply', unit_concepts: ['算法步骤'] },
    { description: '能将知识迁移到实际问题建模', cognitive_dimension: 'analyze', unit_concepts: ['应用模型'] },
    { description: '了解知识的前沿延伸方向', cognitive_dimension: 'remember', unit_concepts: ['前沿延伸'] },
  ],
}

export async function POST(req: NextRequest) {
  const { bookId, text, fileName } = await req.json()

  let parsed: ParseResult
  if (!process.env.ANTHROPIC_API_KEY) {
    parsed = MOCK_PARSE_RESULT
  } else {
    const raw = await callClaude(
      [{ role: 'user', content: buildParseBookPrompt(text, fileName) }],
      buildParseBookSystem(),
      8000
    )
    parsed = parseJSON<ParseResult>(raw, MOCK_PARSE_RESULT)
  }

  const skeletonId = randomUUID()
  // 四层信息整体存入骨架（结构层+教学设计层+风格层；知识层单独成表）
  createSkeleton({
    id: skeletonId, book_id: bookId, original_file_name: fileName,
    toc_json: JSON.stringify({ chapters: parsed.chapters, teaching_design: parsed.teaching_design, style: parsed.style }),
  })

  // AI 识别的学习目标 → 自动进入学习目标库（新建独立库，老师可在目标库页调整）
  const book = getBook(bookId)
  const VALID_DIMS = new Set(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'])
  const extracted: LearningObjective[] = []
  const conceptToObjIds = new Map<string, string[]>()
  if (parsed.objectives?.length) {
    const libId = randomUUID()
    createLibrary({
      id: libId,
      name: `《${fileName.replace(/\.[^.]+$/, '')}》· AI 提取`,
      subject: book?.topic ?? '',
      grade_level: book?.audience_grade ?? '',
    })
    for (const o of parsed.objectives) {
      if (!o.description?.trim()) continue
      const obj = createObjective({
        id: randomUUID(),
        library_id: libId,
        subject: book?.topic ?? '',
        grade_level: book?.audience_grade ?? '',
        description: o.description.trim(),
        cognitive_dimension: (VALID_DIMS.has(o.cognitive_dimension) ? o.cognitive_dimension : 'understand') as LearningObjective['cognitive_dimension'],
        tags: ['AI提取'],
      })
      extracted.push(obj)
      for (const c of o.unit_concepts ?? []) {
        if (!conceptToObjIds.has(c)) conceptToObjIds.set(c, [])
        conceptToObjIds.get(c)!.push(obj.id)
      }
    }
  }

  const units = (parsed.units || []).map((u, i) => ({
    id: randomUUID(),
    skeleton_id: skeletonId,
    chapter_title: u.chapter_title,
    section_title: u.section_title,
    core_concept: u.core_concept,
    definition: u.definition ?? null,
    examples: Array.isArray(u.examples) ? u.examples : [],
    difficulty: (['easy', 'medium', 'hard'].includes(u.difficulty ?? '') ? u.difficulty : 'medium') as 'easy' | 'medium' | 'hard',
    intent: 'keep' as const,
    objective_ids: conceptToObjIds.get(u.core_concept) ?? [],  // 提取目标直接关联到单元
    order_index: i,
  }))
  batchCreateKnowledgeUnits(units)

  return NextResponse.json({
    skeletonId,
    unitCount: units.length,
    extractedObjectiveIds: extracted.map(o => o.id),
    extractedCount: extracted.length,
    meta: { chapters: parsed.chapters, teaching_design: parsed.teaching_design, style: parsed.style },
  })
}
