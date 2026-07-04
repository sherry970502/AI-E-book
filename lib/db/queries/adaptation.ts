import { getDb } from '../index'

export interface AdaptationPlan {
  book_id: string
  audience_note: string
  pedagogy: string
  free_intent: string
  structured_intent: string[]  // 自由意图解析出的结构化改编指令
  confirmed: number
}

export function getAdaptationPlan(bookId: string): AdaptationPlan | null {
  const row = getDb().prepare(`SELECT * FROM adaptation_plans WHERE book_id = ?`).get(bookId) as (Omit<AdaptationPlan, 'structured_intent'> & { structured_intent: string }) | null
  if (!row) return null
  return { ...row, structured_intent: JSON.parse(row.structured_intent || '[]') }
}

export function upsertAdaptationPlan(plan: AdaptationPlan) {
  getDb().prepare(`
    INSERT INTO adaptation_plans (book_id, audience_note, pedagogy, free_intent, structured_intent, confirmed, updated_at)
    VALUES (?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(book_id) DO UPDATE SET
      audience_note = excluded.audience_note,
      pedagogy = excluded.pedagogy,
      free_intent = excluded.free_intent,
      structured_intent = excluded.structured_intent,
      confirmed = excluded.confirmed,
      updated_at = datetime('now')
  `).run(plan.book_id, plan.audience_note, plan.pedagogy, plan.free_intent, JSON.stringify(plan.structured_intent), plan.confirmed)
}
