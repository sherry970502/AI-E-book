import { NextRequest, NextResponse } from 'next/server'
import { callClaude, parseJSON } from '@/lib/ai'
import { buildDraftObjectivesSystem, buildDraftObjectivesPrompt } from '@/lib/prompts/draft'
import { createLibrary, createObjective } from '@/lib/db/queries/objectives'
import { randomUUID } from 'crypto'
import type { LearningObjective } from '@/types'

interface DraftGroup {
  module: string
  objectives: { description: string; cognitive_dimension: string }[]
}

const VALID_DIMS = new Set(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'])

/** Mock：每模块两条通用目标，保证向导可走通 */
function mockGroups(modules: { name: string }[]): DraftGroup[] {
  return modules.map((m, i) => ({
    module: m.name,
    objectives: [
      { description: `（Mock）能准确陈述「${m.name}」的核心概念并举出一个实例`, cognitive_dimension: i < 2 ? 'understand' : 'apply' },
      { description: `（Mock）能运用「${m.name}」的关键原理分析一个典型情形`, cognitive_dimension: i < 2 ? 'apply' : 'analyze' },
    ],
  }))
}

/**
 * 从零起草②：按确认的模块生成学习目标 → 自动沉淀入目标库（《主题》· AI 起草）。
 * 目标先于大纲——它是后续目录生成(objective_idx)、覆盖矩阵、双向追溯的锚。
 */
export async function POST(req: NextRequest) {
  const { topic, audience_grade, audience_age, prior_level, modules } = await req.json()
  if (!topic?.trim() || !Array.isArray(modules) || !modules.length) {
    return NextResponse.json({ error: '缺少主题或模块' }, { status: 400 })
  }

  let groups: DraftGroup[]
  if (!process.env.ANTHROPIC_API_KEY) {
    groups = mockGroups(modules)
  } else {
    const raw = await callClaude(
      [{ role: 'user', content: buildDraftObjectivesPrompt(topic, { grade: audience_grade ?? '', age: audience_age ?? '', prior: prior_level ?? '' }, modules) }],
      buildDraftObjectivesSystem(),
      6000
    )
    groups = parseJSON<DraftGroup[]>(raw, mockGroups(modules))
    if (!Array.isArray(groups) || !groups.length) groups = mockGroups(modules)
  }

  // 沉淀入库（沿用线路 B「AI提取」建库先例）：《主题》· AI 起草
  const libId = randomUUID()
  createLibrary({ id: libId, name: `《${topic.trim()}》· AI 起草`, subject: topic.trim(), grade_level: audience_grade ?? '' })

  const result: { module: string; objectives: LearningObjective[] }[] = []
  for (const g of groups) {
    const saved: LearningObjective[] = []
    for (const o of g.objectives ?? []) {
      if (!o.description?.trim()) continue
      saved.push(createObjective({
        id: randomUUID(),
        library_id: libId,
        subject: topic.trim(),
        grade_level: audience_grade ?? '',
        description: o.description.trim(),
        cognitive_dimension: (VALID_DIMS.has(o.cognitive_dimension) ? o.cognitive_dimension : 'understand') as LearningObjective['cognitive_dimension'],
        tags: ['AI起草', g.module].filter(Boolean),
      }))
    }
    if (saved.length) result.push({ module: g.module, objectives: saved })
  }

  return NextResponse.json({
    libraryId: libId,
    groups: result,
    total: result.reduce((n, g) => n + g.objectives.length, 0),
  })
}
