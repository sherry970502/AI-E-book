import { getDb } from '../index'
import type { Paragraph } from '@/types'

export function getParagraphs(sectionId: string): Paragraph[] {
  const rows = getDb()
    .prepare(`SELECT * FROM paragraphs WHERE section_id = ? ORDER BY order_index ASC`)
    .all(sectionId) as Array<Omit<Paragraph, 'objective_ids'> & { objective_ids: string }>
  return rows.map(r => ({ ...r, objective_ids: JSON.parse(r.objective_ids || '[]') }))
}

export function createParagraph(data: Omit<Paragraph, 'objective_ids'> & { objective_ids: string[] }): void {
  getDb().prepare(`
    INSERT INTO paragraphs (id,section_id,order_index,content,objective_ids,source_tag)
    VALUES (?,?,?,?,?,?)
  `).run(data.id, data.section_id, data.order_index, data.content,
    JSON.stringify(data.objective_ids), data.source_tag ?? null)
}

export function deleteParagraphsBySection(sectionId: string) {
  getDb().prepare(`DELETE FROM paragraphs WHERE section_id = ?`).run(sectionId)
}
