import { NextRequest, NextResponse } from 'next/server'
import { callClaude, parseJSON } from '@/lib/ai'
import { buildAlignSystem, buildAlignPrompt } from '@/lib/prompts/align'
import { getKnowledgeUnits, updateKnowledgeUnitIntent } from '@/lib/db/queries/skeletons'
import { getObjectivesByIds, listObjectives } from '@/lib/db/queries/objectives'
import type { AlignmentEntry } from '@/types'

export async function POST(req: NextRequest) {
  const { skeletonId, objectiveIds } = await req.json()

  const units = getKnowledgeUnits(skeletonId)
  const objectives = objectiveIds?.length
    ? getObjectivesByIds(objectiveIds)
    : listObjectives()

  let result: { alignments: AlignmentEntry[] }

  if (!process.env.ANTHROPIC_API_KEY) {
    result = {
      alignments: objectives.slice(0, 6).map((obj, i) => ({
        objective_id: obj.id,
        status: (['covered', 'covered', 'gap', 'redundant', 'misaligned', 'covered'] as const)[i % 6],
        unit_ids: units.slice(0, 2).map(u => u.id),
        notes: '（mock 对齐结果）',
      })),
    }
  } else {
    const raw = await callClaude(
      [{ role: 'user', content: buildAlignPrompt(units, objectives) }],
      buildAlignSystem(),
      8000
    )
    result = parseJSON<{ alignments: AlignmentEntry[] }>(raw, { alignments: [] })
  }

  // Back-fill objective_ids onto knowledge units
  for (const entry of result.alignments) {
    for (const unitId of entry.unit_ids || []) {
      const unit = units.find(u => u.id === unitId)
      if (unit) {
        const newObjIds = Array.from(new Set([...unit.objective_ids, entry.objective_id]))
        updateKnowledgeUnitIntent(unitId, unit.intent ?? 'keep', newObjIds)
      }
    }
  }

  return NextResponse.json(result)
}
