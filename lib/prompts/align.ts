import type { LearningObjective, KnowledgeUnit } from '@/types'

export function buildAlignSystem() {
  return `你是教育目标对齐专家，擅长将课本知识单元与学习目标库进行精确映射。
返回严格合法的 JSON，不要有多余文字。`
}

export function buildAlignPrompt(
  units: Array<{ id: string; core_concept: string; definition?: string | null }>,
  objectives: LearningObjective[]
) {
  const objList = objectives.map(o => `[${o.id}] ${o.description} (${o.cognitive_dimension})`).join('\n')
  const unitList = units.map(u => `[${u.id}] ${u.core_concept}: ${u.definition ?? ''}`).join('\n')

  return `将以下知识单元与学习目标对齐：

知识单元：
${unitList}

学习目标库（共 ${objectives.length} 条）：
${objList}

请返回 JSON：
{
  "mappings": [
    { "unit_id": "知识单元id", "objective_ids": ["目标id1", "目标id2"] }
  ],
  "gaps": ["没有被任何知识单元覆盖的目标id"],
  "redundant_unit_ids": ["不对应任何目标的知识单元id"],
  "misaligned": [{ "objective_id": "目标id", "issue": "错位原因说明" }]
}`
}
