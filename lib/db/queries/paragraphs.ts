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

// ── 主编段落级操作（老师通过对话直接改正文）──────────────────────────────────

export function updateParagraphContent(id: string, content: string, sourceTag?: Paragraph['source_tag']) {
  if (sourceTag) {
    getDb().prepare(`UPDATE paragraphs SET content = ?, source_tag = ? WHERE id = ?`).run(content, sourceTag, id)
  } else {
    getDb().prepare(`UPDATE paragraphs SET content = ? WHERE id = ?`).run(content, id)
  }
}

export function deleteParagraph(id: string) {
  getDb().prepare(`DELETE FROM paragraphs WHERE id = ?`).run(id)
}

/** 按现有顺序把 order_index 归整为 0..n-1（插入/删除后消除小数占位与断号） */
export function renumberParagraphs(sectionId: string) {
  const rows = getDb()
    .prepare(`SELECT id FROM paragraphs WHERE section_id = ? ORDER BY order_index ASC`)
    .all(sectionId) as Array<{ id: string }>
  const stmt = getDb().prepare(`UPDATE paragraphs SET order_index = ? WHERE id = ?`)
  rows.forEach((r, i) => stmt.run(i, r.id))
}
