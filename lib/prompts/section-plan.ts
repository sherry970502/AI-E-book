import type { Book, Section, Chapter, LearningObjective } from '@/types'
import { getGenre } from '@/lib/genres'

/**
 * 正文脉络设计（section-plan）：为小节规划「教学颗粒序列」，供老师逐颗粒确认去留。
 * 颗粒类型见 types 里 BLOCK_TYPE_META。体裁的 planHint 决定颗粒按什么叙事逻辑组织。
 */

export function buildSectionPlanSystem() {
  return '你是教学设计专家，把小节内容规划为教学颗粒序列。只输出 JSON。'
}

export function buildSectionPlanPrompt(
  section: Pick<Section, 'title' | 'brief'>,
  chapterTitle: string,
  objectives: LearningObjective[],
  book: Book,
  pedagogy?: string
) {
  return `为教材小节设计正文脉络（教学颗粒序列）。

小节：${section.title}（所属：${chapterTitle}）
教学要点（老师已确认）：${section.brief || '无'}
学习目标：${objectives.map(o => `${o.description}（${o.cognitive_dimension}）`).join('；') || '无'}
受众：${book.audience_grade}；风格：${book.style}${pedagogy ? `；教学法偏好：${pedagogy}` : ''}
${getGenre(book.genre).planHint ? `\n【体裁】本书体裁为「${getGenre(book.genre).label}」：${getGenre(book.genre).planHint}\n` : ''}
可用颗粒类型：intro(情境导入) concept(核心概念) callout(重点说明) example(典型例题) figure(配图示意) summary(小结) exercise(互动练习)

要求：5-8 个颗粒组成合理的教学递进；每个颗粒的 desc 一句话写清具体承载什么（结合教学要点，不写空话）；同类型可出现多次（如两道例题）。

只输出 JSON 数组：[{"type":"intro","desc":"..."},...]`
}
