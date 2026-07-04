import { getDb } from '../index'
import type { LearningObjective, ObjectiveLibrary } from '@/types'

export function listLibraries(): ObjectiveLibrary[] {
  return getDb().prepare(`SELECT * FROM objective_libraries ORDER BY created_at ASC`).all() as ObjectiveLibrary[]
}

export function listObjectives(libraryId?: string): LearningObjective[] {
  if (libraryId) {
    const rows = getDb()
      .prepare(`SELECT * FROM learning_objectives WHERE library_id = ? ORDER BY created_at ASC`)
      .all(libraryId) as Array<Omit<LearningObjective, 'tags'> & { tags: string }>
    return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }))
  }
  const rows = getDb()
    .prepare(`SELECT * FROM learning_objectives ORDER BY library_id, created_at ASC`)
    .all() as Array<Omit<LearningObjective, 'tags'> & { tags: string }>
  return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }))
}

export function getObjective(id: string): LearningObjective | null {
  const row = getDb().prepare(`SELECT * FROM learning_objectives WHERE id = ?`).get(id) as (Omit<LearningObjective, 'tags'> & { tags: string }) | null
  if (!row) return null
  return { ...row, tags: JSON.parse(row.tags || '[]') }
}

export function getObjectivesByIds(ids: string[]): LearningObjective[] {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(',')
  const rows = getDb()
    .prepare(`SELECT * FROM learning_objectives WHERE id IN (${placeholders})`)
    .all(...ids) as Array<Omit<LearningObjective, 'tags'> & { tags: string }>
  return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }))
}

export function createLibrary(data: ObjectiveLibrary): ObjectiveLibrary {
  getDb().prepare(`
    INSERT INTO objective_libraries (id,name,subject,grade_level) VALUES (?,?,?,?)
  `).run(data.id, data.name, data.subject, data.grade_level)
  return data
}

export function createObjective(data: LearningObjective): LearningObjective {
  getDb().prepare(`
    INSERT INTO learning_objectives (id,library_id,subject,grade_level,description,cognitive_dimension,tags)
    VALUES (?,?,?,?,?,?,?)
  `).run(data.id, data.library_id, data.subject, data.grade_level, data.description,
    data.cognitive_dimension, JSON.stringify(data.tags || []))
  return data
}

export function updateObjective(id: string, patch: { description?: string; cognitive_dimension?: string; library_id?: string }) {
  const fields: string[] = []
  const params: string[] = []
  if (patch.description !== undefined) { fields.push('description = ?'); params.push(patch.description) }
  if (patch.cognitive_dimension !== undefined) { fields.push('cognitive_dimension = ?'); params.push(patch.cognitive_dimension) }
  if (patch.library_id !== undefined) { fields.push('library_id = ?'); params.push(patch.library_id) }
  if (!fields.length) return
  getDb().prepare(`UPDATE learning_objectives SET ${fields.join(', ')} WHERE id = ?`).run(...params, id)
}

export function deleteObjective(id: string) {
  getDb().prepare(`DELETE FROM learning_objectives WHERE id = ?`).run(id)
}

export function deleteLibrary(id: string) {
  getDb().prepare(`DELETE FROM objective_libraries WHERE id = ?`).run(id)
}
