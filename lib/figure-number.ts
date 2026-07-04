import { getSection, getChapters } from './db/queries/books'
import { getIllustrationsBySection } from './db/queries/illustrations'

/** 学术图注编号：图{章号}.{本节内序号}（需求 3.5）*/
export function figureNumberFor(sectionId: string): string {
  const section = getSection(sectionId)
  if (!section) return '图1.1'
  const chapters = getChapters(section.book_id)
  const chapterNo = chapters.findIndex(c => c.id === section.chapter_id) + 1
  const count = getIllustrationsBySection(sectionId).length
  return `图${chapterNo || 1}.${count + 1}`
}
