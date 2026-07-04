import Database from 'better-sqlite3'
import path from 'path'
import { initSchema } from './schema'

const DB_PATH = path.join(process.cwd(), 'ai-ebook.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
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
