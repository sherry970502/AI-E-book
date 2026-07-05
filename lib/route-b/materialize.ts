import { createSection, getSectionsByChapter, updateSection } from '@/lib/db/queries/books'
import { randomUUID } from 'crypto'
import type { Chapter, KnowledgeUnit, Section } from '@/types'

/**
 * 重排一章内各小节标题的「章.节」序号，使其与实际顺序一致（删除/恢复后消除断号与重号）。
 * 只改开头的「数字.数字」前缀，保留概念名；老师改成不带序号的自定义标题则不动。
 */
export function renumberChapterSections(chapterId: string, chapterNumber: number) {
  getSectionsByChapter(chapterId).forEach((sec, i) => {
    const renumbered = sec.title.replace(/^\s*\d+\.\d+\s*/, `${chapterNumber}.${i + 1} `)
    if (renumbered !== sec.title && /^\s*\d+\.\d+/.test(sec.title)) {
      updateSection(sec.id, { title: renumbered })
    }
  })
}

/**
 * 把一个原书知识单元物化成新书的一个小节（章/节标题沿用原书，要点取自定义+例证）。
 * materialize（首次铺开）与 reconcile（删除后恢复）共用，保证两处生成的小节完全一致。
 * @param chapterNumber 章序号（1 起），@param positionNumber 节在本章的序号（1 起）
 */
export function materializeUnitSection(
  bookId: string,
  chapter: Chapter,
  unit: KnowledgeUnit,
  orderIndex: number,
  chapterNumber: number,
  positionNumber: number,
): Section {
  return createSection({
    id: randomUUID(),
    chapter_id: chapter.id,
    book_id: bookId,
    order_index: orderIndex,
    title: `${chapterNumber}.${positionNumber} ${unit.section_title || unit.core_concept}`,
    content: null,
    status: 'pending',
    objective_ids: unit.objective_ids,
    page_number: null,
    source_unit_id: unit.id,
    brief: [unit.definition, unit.examples.length ? `原书例证：${unit.examples.join('；')}` : '']
      .filter(Boolean).join('。'),
  })
}
