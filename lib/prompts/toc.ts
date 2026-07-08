import type { Book, LearningObjective } from '@/types'
import { getGenre } from '@/lib/genres'

export function buildTocSystem() {
  return `你是资深教材主编，负责为新课本设计目录结构。

输出格式（严格遵守）：NDJSON——每行一个独立的 JSON 对象代表一章，按顺序逐章输出。不要输出任何其他文字，不要用代码块包裹，每章 JSON 必须写在同一行内。

每行格式：
{"title":"第一章 章名","summary":"本章教学大纲：讲什么、怎么递进（40-70字）","objective_idx":[1,3],"sections":[{"title":"1.1 节名","brief":"本节教学要点：具体讲哪些内容、达到什么程度（30-50字）","objective_idx":[1]}]}

objective_idx 是从「学习目标列表」中选取的目标序号（1-based）。每章覆盖 2-4 个目标，每节 1-2 个；所有目标应尽量被目录覆盖。
summary 和 brief 是给老师审阅的教学脉络——必须具体（写清知识点与讲法），不要空话。
JSON 合法性（重要）：字符串值内部禁止出现未转义的英文双引号与换行；引用书名/名句一律用中文引号「」或《》。`
}

export function buildTocPrompt(book: Book, objectives: LearningObjective[]) {
  const objList = objectives.length
    ? objectives.slice(0, 40).map((o, i) => `${i + 1}. ${o.description}（${o.cognitive_dimension}）`).join('\n')
    : '（未勾选目标，请按主题自行组织，objective_idx 输出空数组）'

  const chapterCount = Math.max(3, Math.min(10, Math.round(book.target_page_count / 12)))
  const genre = getGenre(book.genre)

  return `课本信息：
- 名称：${book.title}
- 主题：${book.topic}
- 定位：${book.positioning || '（未填写）'}
- 受众：${book.audience_grade} / ${book.audience_age} / 先验水平：${book.prior_level}
- 风格：${book.style}
- 规模：约 ${book.target_word_count} 字 / ${book.target_page_count} 页 → 建议 ${chapterCount} 章左右，每章 2-4 节
${genre.tocContract ? `\n${genre.tocContract}\n（体裁契约优先于上面的章节数建议；但输出格式仍是「章-节」两级 JSON，objective_idx 照常关联——学习目标锚定不因体裁改变）\n` : ''}
学习目标列表：
${objList}

请设计目录，逐行输出每章的 JSON。`
}
