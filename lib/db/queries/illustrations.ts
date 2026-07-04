import { getDb } from '../index'
import type { Illustration } from '@/types'

export function getIllustrationsBySection(sectionId: string): Illustration[] {
  return getDb()
    .prepare(`SELECT * FROM illustrations WHERE section_id = ? ORDER BY rowid ASC`)
    .all(sectionId) as Illustration[]
}

export function updateIllustrationParagraph(id: string, paragraphId: string | null) {
  getDb().prepare(`UPDATE illustrations SET paragraph_id = ? WHERE id = ?`).run(paragraphId, id)
}

export function createIllustration(data: Omit<Illustration, never>): Illustration {
  getDb().prepare(`
    INSERT INTO illustrations (id,section_id,paragraph_id,caption,figure_number,source,url,svg_content)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(data.id, data.section_id, data.paragraph_id ?? null, data.caption,
    data.figure_number, data.source, data.url ?? null, data.svg_content ?? null)
  return data
}

export function deleteIllustration(id: string) {
  getDb().prepare(`DELETE FROM illustrations WHERE id = ?`).run(id)
}

export function updateIllustrationCaption(id: string, caption: string) {
  getDb().prepare(`UPDATE illustrations SET caption = ? WHERE id = ?`).run(caption, id)
}
