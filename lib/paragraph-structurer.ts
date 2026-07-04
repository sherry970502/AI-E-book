import { randomUUID } from 'crypto'
import { createParagraph, deleteParagraphsBySection } from './db/queries/paragraphs'
import type { LearningObjective, SourceTag } from '@/types'

const MARKER_RE = /<!--m\s+o=([\d,\s]*)\s+s=([\w-]*)\s*-->/g

const VALID_TAGS = new Set<string>(['rewritten', 'generated', 'teacher-specified'])

/**
 * 解析带标记的生成内容 → 干净 Markdown + 结构化段落行。
 * 标记协议见 lib/prompts/section.ts。
 * 无标记的内容块按小节目标轮转分配（兜底，保证双向追溯不空洞）。
 */
export function structureSectionContent(
  sectionId: string,
  rawContent: string,
  sectionObjectives: LearningObjective[],
  defaultTag: SourceTag = 'generated'
): string {
  interface Block { content: string; objectiveIds: string[]; sourceTag: SourceTag }
  const blocks: Block[] = []

  let lastIndex = 0
  let match: RegExpExecArray | null
  MARKER_RE.lastIndex = 0
  while ((match = MARKER_RE.exec(rawContent)) !== null) {
    const content = rawContent.slice(lastIndex, match.index).trim()
    lastIndex = MARKER_RE.lastIndex
    if (!content) continue
    const objIdx = match[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    const objectiveIds = objIdx.map(i => sectionObjectives[i - 1]?.id).filter(Boolean) as string[]
    const tag = (VALID_TAGS.has(match[2]) ? match[2] : defaultTag) as SourceTag
    blocks.push({ content, objectiveIds, sourceTag: tag })
  }
  // 末尾无标记的剩余内容
  const tail = rawContent.slice(lastIndex).trim()
  if (tail) blocks.push({ content: tail, objectiveIds: [], sourceTag: defaultTag })

  // 完全没有标记（模型不守协议时）：按空行切块，目标轮转分配兜底
  if (blocks.length <= 1 && !MARKER_RE.test(rawContent)) {
    blocks.length = 0
    const chunks = rawContent.split(/\n\s*\n/).map(c => c.trim()).filter(Boolean)
    chunks.forEach((content, i) => {
      const obj = sectionObjectives.length ? [sectionObjectives[i % sectionObjectives.length].id] : []
      blocks.push({ content, objectiveIds: obj, sourceTag: defaultTag })
    })
  }

  deleteParagraphsBySection(sectionId)
  blocks.forEach((b, i) => {
    createParagraph({
      id: randomUUID(),
      section_id: sectionId,
      order_index: i,
      content: b.content,
      objective_ids: b.objectiveIds,
      source_tag: b.sourceTag,
    })
  })

  // 干净正文（剥掉所有标记）
  return rawContent.replace(MARKER_RE, '').replace(/\n{3,}/g, '\n\n').trim()
}
