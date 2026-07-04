import { getDb } from '../index'
import type { Question } from '@/types'

export function getQuestions(sectionId: string): Question[] {
  const rows = getDb()
    .prepare(`SELECT * FROM questions WHERE section_id = ? ORDER BY rowid ASC`)
    .all(sectionId) as Array<Omit<Question, 'options' | 'objective_ids'> & { options: string; objective_ids: string }>
  return rows.map(r => ({
    ...r,
    options: JSON.parse(r.options || '[]'),
    objective_ids: JSON.parse(r.objective_ids || '[]'),
  }))
}

export function createQuestion(data: Question): void {
  getDb().prepare(`
    INSERT INTO questions (id,section_id,stem,options,explanation,objective_ids)
    VALUES (?,?,?,?,?,?)
  `).run(
    data.id, data.section_id, data.stem,
    JSON.stringify(data.options), data.explanation ?? null,
    JSON.stringify(data.objective_ids)
  )
}

export function batchCreateQuestions(questions: Question[]) {
  const db = getDb()
  const insert = db.prepare(`
    INSERT INTO questions (id,section_id,stem,options,explanation,objective_ids)
    VALUES (?,?,?,?,?,?)
  `)
  db.transaction((qs: Question[]) => {
    for (const q of qs) {
      insert.run(q.id, q.section_id, q.stem, JSON.stringify(q.options), q.explanation ?? null, JSON.stringify(q.objective_ids))
    }
  })(questions)
}

export function deleteQuestionsBySection(sectionId: string) {
  getDb().prepare(`DELETE FROM questions WHERE section_id = ?`).run(sectionId)
}
