import { getDb } from '../index'
import type { Skeleton, KnowledgeUnit } from '@/types'

export function getSkeleton(bookId: string): Skeleton | null {
  const row = getDb().prepare(`SELECT * FROM skeletons WHERE book_id = ?`).get(bookId) as Skeleton | null
  return row
}

export function createSkeleton(data: Omit<Skeleton, 'created_at'>): Skeleton {
  getDb().prepare(`
    INSERT INTO skeletons (id,book_id,original_file_name,toc_json) VALUES (?,?,?,?)
  `).run(data.id, data.book_id, data.original_file_name, data.toc_json)
  return getSkeleton(data.book_id)!
}

// ─── Knowledge Units ───────────────────────────────────────────────────────────

export function getKnowledgeUnits(skeletonId: string): KnowledgeUnit[] {
  const rows = getDb()
    .prepare(`SELECT * FROM knowledge_units WHERE skeleton_id = ? ORDER BY rowid ASC`)
    .all(skeletonId) as Array<Omit<KnowledgeUnit, 'examples' | 'objective_ids'> & { examples: string; objective_ids: string }>
  return rows.map(r => ({
    ...r,
    examples: JSON.parse(r.examples || '[]'),
    objective_ids: JSON.parse(r.objective_ids || '[]'),
  }))
}

export function createKnowledgeUnit(data: Omit<KnowledgeUnit, 'examples' | 'objective_ids'> & { examples: string[]; objective_ids: string[] }): KnowledgeUnit {
  getDb().prepare(`
    INSERT INTO knowledge_units (id,skeleton_id,chapter_title,section_title,core_concept,definition,examples,difficulty,intent,objective_ids)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    data.id, data.skeleton_id, data.chapter_title, data.section_title,
    data.core_concept, data.definition ?? null,
    JSON.stringify(data.examples), data.difficulty ?? null, data.intent ?? null,
    JSON.stringify(data.objective_ids)
  )
  return { ...data }
}

export function updateKnowledgeUnitIntent(id: string, intent: string, objectiveIds: string[]) {
  getDb().prepare(`
    UPDATE knowledge_units SET intent = ?, objective_ids = ? WHERE id = ?
  `).run(intent, JSON.stringify(objectiveIds), id)
}

export function batchCreateKnowledgeUnits(units: Array<Omit<KnowledgeUnit, 'examples' | 'objective_ids'> & { examples: string[]; objective_ids: string[] }>) {
  const db = getDb()
  const insert = db.prepare(`
    INSERT INTO knowledge_units (id,skeleton_id,chapter_title,section_title,core_concept,definition,examples,difficulty,intent,objective_ids)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `)
  const insertMany = db.transaction((rows: typeof units) => {
    for (const r of rows) {
      insert.run(
        r.id, r.skeleton_id, r.chapter_title, r.section_title,
        r.core_concept, r.definition ?? null,
        JSON.stringify(r.examples), r.difficulty ?? null, r.intent ?? null,
        JSON.stringify(r.objective_ids)
      )
    }
  })
  insertMany(units)
}
