import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { initSchema } from './schema'

/**
 * 数据库文件位置：
 * - 本地开发：项目根目录 ai-ebook.db（默认，行为不变）
 * - 线上（Zeabur 等）：设环境变量 DB_PATH=/data/ai-ebook.db，把库放进持久 Volume——
 *   否则写在应用目录里，每次重新部署数据就被清空
 */
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'ai-ebook.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    // 确保目录存在（如 Volume 挂载点下的子路径）
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initSchema(_db)
    seedObjectivesIfEmpty(_db)
  }
  return _db
}

function seedObjectivesIfEmpty(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as n FROM objective_libraries').get() as { n: number }).n
  if (count > 0) return
  // Dynamic import to avoid circular issues — run seed inline
  const { seedObjectives } = require('../objectives-seed')
  seedObjectives(db)
}
