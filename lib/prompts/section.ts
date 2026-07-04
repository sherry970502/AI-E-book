import type { Book, Section, Chapter, LearningObjective, KnowledgeUnit } from '@/types'

/**
 * 段落元信息标记协议：
 * 正文中每个段落块（含小标题的一组内容）之后，单独一行输出标记：
 *   <!--m o=1,2 s=generated-->
 * o = 该段覆盖的学习目标序号（1-based，对应 prompt 中的目标列表），可为空（o=）
 * s = 来源标记 rewritten | generated | teacher-specified
 * 入库时标记被剥离为干净 Markdown，同时生成段落行（objective_ids + source_tag）。
 */

export function buildSectionSystem(book: Book) {
  const styleMap: Record<string, string> = {
    academic: '学术严谨，逻辑清晰，引用规范',
    casual: '轻松活泼，多用类比和生活例子，语气亲切',
    mixed: '深入浅出，兼顾知识密度与可读性',
  }
  return `你是${book.topic}领域的专业教材作者。
受众：${book.audience_grade}，${book.audience_age}，先验水平：${book.prior_level}。
写作风格：${styleMap[book.style] ?? book.style}。

输出 Markdown 正文，遵守以下排版规范：
- 重要概念首次出现时**粗体**
- 「重点说明」（关键结论/深入分析/易错警示）用 > 引用框，且必须独立成块——它是独立的教学内容块，有自己的标记行，不与普通叙述段合并
- 需要图示处用 [图：描述] 占位
- 每 2-4 段可插入 ### 小标题

【必须遵守的标记协议】每个段落块（一个自然段，或小标题+紧随内容）之后，单独一行输出：
<!--m o=目标序号列表 s=来源标记-->
例如 <!--m o=1,2 s=generated--> 或 <!--m o= s=generated-->（该段不对应任何目标时）。`
}

export function buildSectionPrompt(
  chapter: Chapter,
  section: Section,
  objectives: LearningObjective[],
  units?: KnowledgeUnit[]
) {
  const objDesc = objectives.length
    ? objectives.map((o, i) => `${i + 1}. ${o.description}（${o.cognitive_dimension}）`).join('\n')
    : '（本节未关联目标，标记中 o 留空）'
  const unitCtx = units && units.length > 0
    ? `\n参考素材（原书知识单元，可作为写作材料）：\n${units.map(u => `- ${u.core_concept}: ${u.definition ?? ''}`).join('\n')}`
    : ''

  // 已确认的正文脉络（教学颗粒序列）——生成的最高优先级约束
  const enabledBlocks = (section.block_plan ?? []).filter(b => b.enabled && b.type !== 'exercise')
  const planCtx = enabledBlocks.length
    ? `\n【正文脉络（老师已逐颗粒确认，必须严格按此顺序逐块撰写，不得增删颗粒）】\n${enabledBlocks.map((b, i) => `${i + 1}. [${b.type}] ${b.desc}`).join('\n')}\n（callout 颗粒用 > 引用框；figure 颗粒用 [图：描述] 占位；每个颗粒独立成块并带标记行）`
    : '\n（未设计脉络：先铺垫概念，再深入分析，最后小结）'

  return `请为以下小节撰写正文：

所属章节：${chapter.title}${chapter.summary ? `（本章教学大纲：${chapter.summary}）` : ''}
小节标题：${section.title}
${section.brief ? `本节教学要点（老师已确认，必须严格遵循）：${section.brief}` : ''}

需要覆盖的学习目标（标记协议中的序号以此为准）：
${objDesc}
${unitCtx}${planCtx}

要求：
- 正文 800-1200 字
- 每个段落块后按协议输出 <!--m o=... s=generated--> 标记`
}

export function buildRegeneratePrompt(
  chapter: Chapter,
  section: Section,
  objectives: LearningObjective[],
  units: KnowledgeUnit[],
  intent: string,
  audienceNote: string,
  pedagogy: string
) {
  const objDesc = objectives.length
    ? objectives.map((o, i) => `${i + 1}. ${o.description}（${o.cognitive_dimension}）`).join('\n')
    : '（无）'
  const keepUnits = units.filter(u => u.intent === 'keep')
  const rewriteUnits = units.filter(u => u.intent === 'rewrite')

  return `这是一次「原书改编」写作。改的是骨架，原文只是素材语料。

所属章节：${chapter.title}
小节标题：${section.title}

学习目标（标记序号以此为准）：
${objDesc}

【保留原意改写】的知识单元（写作时忠实其原意，s=rewritten）：
${keepUnits.map(u => `- ${u.core_concept}: ${u.definition ?? ''}${u.examples.length ? `；例：${u.examples.join('；')}` : ''}`).join('\n') || '（无）'}

【深度重写/全新生成】的内容（按新受众与意图重新创作，s=generated）：
${rewriteUnits.map(u => `- ${u.core_concept}: ${u.definition ?? ''}`).join('\n') || '（无，需全新生成的目标内容也用 s=generated）'}

改编要求：
- 受众迁移：${audienceNote || '无'}
- 教学法偏好：${pedagogy || '无'}
- 老师意图：${intent || '无'}——老师明确指定写入的内容，标记 s=teacher-specified

正文 800-1200 字。每个段落块后按协议输出 <!--m o=... s=...--> 标记，s 按上述规则取 rewritten / generated / teacher-specified。`
}
