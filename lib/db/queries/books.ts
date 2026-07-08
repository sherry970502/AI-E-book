import { getDb } from '../index'
import type { Book, Chapter, Section } from '@/types'

// ─── Books ────────────────────────────────────────────────────────────────────

export function listBooks(): Book[] {
  return getDb().prepare(`SELECT * FROM books ORDER BY created_at DESC`).all() as Book[]
}

export function getBook(id: string): Book | null {
  return getDb().prepare(`SELECT * FROM books WHERE id = ?`).get(id) as Book | null
}

export function createBook(data: Omit<Book, 'created_at' | 'updated_at'>): Book {
  const db = getDb()
  db.prepare(`
    INSERT INTO books (id,title,topic,positioning,audience_grade,audience_age,prior_level,style,genre,orientation,target_word_count,target_page_count,source,source_file_path)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    data.id, data.title, data.topic, data.positioning,
    data.audience_grade, data.audience_age, data.prior_level,
    data.style, data.genre ?? 'textbook', data.orientation,
    data.target_word_count, data.target_page_count,
    data.source, data.source_file_path ?? null
  )
  return getBook(data.id)!
}

// ─── Chapters ─────────────────────────────────────────────────────────────────

export function getChapters(bookId: string): Chapter[] {
  const rows = getDb()
    .prepare(`SELECT * FROM chapters WHERE book_id = ? ORDER BY order_index ASC`)
    .all(bookId) as Array<Omit<Chapter, 'objective_ids'> & { objective_ids: string }>
  return rows.map(r => ({ ...r, objective_ids: JSON.parse(r.objective_ids || '[]') }))
}

export function createChapter(data: Omit<Chapter, 'objective_ids'> & { objective_ids: string[] }): Chapter {
  const db = getDb()
  db.prepare(`
    INSERT INTO chapters (id,book_id,order_index,title,summary,objective_ids,status)
    VALUES (?,?,?,?,?,?,?)
  `).run(data.id, data.book_id, data.order_index, data.title, data.summary ?? null,
    JSON.stringify(data.objective_ids), data.status)
  return getChapters(data.book_id).find(c => c.id === data.id)!
}

export function updateChapterStatus(id: string, status: string) {
  getDb().prepare(`UPDATE chapters SET status = ? WHERE id = ?`).run(status, id)
}

export function updateChapter(id: string, patch: { title?: string; summary?: string; objective_ids?: string[] }) {
  const fields: string[] = []
  const params: (string | null)[] = []
  if (patch.title !== undefined) { fields.push('title = ?'); params.push(patch.title) }
  if (patch.summary !== undefined) { fields.push('summary = ?'); params.push(patch.summary) }
  if (patch.objective_ids !== undefined) { fields.push('objective_ids = ?'); params.push(JSON.stringify(patch.objective_ids)) }
  if (!fields.length) return
  getDb().prepare(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`).run(...params, id)
}

export function deleteChapter(id: string) {
  getDb().prepare(`DELETE FROM chapters WHERE id = ?`).run(id)
}

/** 删除/插入后重排章节序号 */
export function normalizeChapterOrder(bookId: string) {
  const db = getDb()
  const rows = db.prepare(`SELECT id FROM chapters WHERE book_id = ? ORDER BY order_index ASC`).all(bookId) as { id: string }[]
  const update = db.prepare(`UPDATE chapters SET order_index = ? WHERE id = ?`)
  const tx = db.transaction(() => rows.forEach((r, i) => update.run(i, r.id)))
  tx()
}

// ─── Sections ─────────────────────────────────────────────────────────────────

type SectionRow = Omit<Section, 'objective_ids' | 'elements' | 'brief' | 'block_plan'> & { objective_ids: string; elements: string; brief: string | null; block_plan: string | null }
const DEFAULT_ELEMENTS = { exercise: true, illustration: false }

function parseSection(r: SectionRow): Section {
  let elements = DEFAULT_ELEMENTS
  try { elements = { ...DEFAULT_ELEMENTS, ...JSON.parse(r.elements || '{}') } } catch { /* noop */ }
  let blockPlan: Section['block_plan'] = []
  try { blockPlan = JSON.parse(r.block_plan || '[]') } catch { /* noop */ }
  return { ...r, objective_ids: JSON.parse(r.objective_ids || '[]'), elements, brief: r.brief ?? '', block_plan: blockPlan }
}

export function getSections(bookId: string): Section[] {
  const rows = getDb()
    .prepare(`SELECT * FROM sections WHERE book_id = ? ORDER BY order_index ASC`)
    .all(bookId) as SectionRow[]
  return rows.map(parseSection)
}

export function getSectionsByChapter(chapterId: string): Section[] {
  const rows = getDb()
    .prepare(`SELECT * FROM sections WHERE chapter_id = ? ORDER BY order_index ASC`)
    .all(chapterId) as SectionRow[]
  return rows.map(parseSection)
}

export function getSection(id: string): Section | null {
  const row = getDb().prepare(`SELECT * FROM sections WHERE id = ?`).get(id) as SectionRow | null
  if (!row) return null
  return parseSection(row)
}

export function updateSectionElements(id: string, elements: Partial<Section['elements']>) {
  const current = getSection(id)
  if (!current) return
  getDb().prepare(`UPDATE sections SET elements = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify({ ...current.elements, ...elements }), id)
}

/** 保存正文脉络，并把练/图元素与脉络中的对应颗粒同步（批量生成沿用元素配置） */
export function updateSectionBlockPlan(id: string, plan: Section['block_plan']) {
  const current = getSection(id)
  if (!current) return
  const elements = {
    ...current.elements,
    exercise: plan.some(b => b.type === 'exercise' && b.enabled),
    illustration: plan.some(b => b.type === 'figure' && b.enabled),
  }
  getDb().prepare(`UPDATE sections SET block_plan = ?, elements = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(plan), JSON.stringify(elements), id)
}

export function createSection(data: Omit<Section, 'objective_ids' | 'elements' | 'brief' | 'block_plan'> & { objective_ids: string[]; elements?: Partial<Section['elements']>; brief?: string }): Section {
  const db = getDb()
  db.prepare(`
    INSERT INTO sections (id,chapter_id,book_id,order_index,title,content,status,objective_ids,page_number,elements,brief,source_unit_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(data.id, data.chapter_id, data.book_id, data.order_index, data.title,
    data.content ?? null, data.status, JSON.stringify(data.objective_ids), data.page_number ?? null,
    JSON.stringify({ ...DEFAULT_ELEMENTS, ...(data.elements ?? {}) }), data.brief ?? '', data.source_unit_id ?? null)
  return getSection(data.id)!
}

export function updateSectionContent(id: string, content: string, status = 'completed') {
  getDb().prepare(`
    UPDATE sections SET content = ?, status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(content, status, id)
}

export function updateSectionStatus(id: string, status: string) {
  getDb().prepare(`UPDATE sections SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id)
}

export function updateSection(id: string, patch: { title?: string; objective_ids?: string[]; brief?: string }) {
  const fields: string[] = []
  const params: string[] = []
  if (patch.title !== undefined) { fields.push('title = ?'); params.push(patch.title) }
  if (patch.objective_ids !== undefined) { fields.push('objective_ids = ?'); params.push(JSON.stringify(patch.objective_ids)) }
  if (patch.brief !== undefined) { fields.push('brief = ?'); params.push(patch.brief) }
  if (!fields.length) return
  getDb().prepare(`UPDATE sections SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params, id)
}

export function deleteSection(id: string) {
  getDb().prepare(`DELETE FROM sections WHERE id = ?`).run(id)
}

export function normalizeSectionOrder(chapterId: string) {
  const db = getDb()
  const rows = db.prepare(`SELECT id FROM sections WHERE chapter_id = ? ORDER BY order_index ASC`).all(chapterId) as { id: string }[]
  const update = db.prepare(`UPDATE sections SET order_index = ? WHERE id = ?`)
  const tx = db.transaction(() => rows.forEach((r, i) => update.run(i, r.id)))
  tx()
}

export function deleteBook(id: string) {
  getDb().prepare(`DELETE FROM books WHERE id = ?`).run(id)
}
