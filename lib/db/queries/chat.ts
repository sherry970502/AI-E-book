import { getDb } from '../index'
import type { ChatNode } from '@/types'

export function getChatHistory(bookId: string, limit = 50): ChatNode[] {
  return getDb()
    .prepare(`SELECT * FROM chat_nodes WHERE book_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(bookId, limit) as ChatNode[]
}

export function addChatNode(data: Omit<ChatNode, 'created_at'>): ChatNode {
  getDb().prepare(`
    INSERT INTO chat_nodes (id,book_id,role,content,scope,target_id) VALUES (?,?,?,?,?,?)
  `).run(data.id, data.book_id, data.role, data.content, data.scope ?? null, data.target_id ?? null)
  return getDb().prepare(`SELECT * FROM chat_nodes WHERE id = ?`).get(data.id) as ChatNode
}

export function clearChatHistory(bookId: string) {
  getDb().prepare(`DELETE FROM chat_nodes WHERE book_id = ?`).run(bookId)
}
