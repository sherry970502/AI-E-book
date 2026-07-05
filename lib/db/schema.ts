import type Database from 'better-sqlite3'

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS objective_libraries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      grade_level TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learning_objectives (
      id TEXT PRIMARY KEY,
      library_id TEXT NOT NULL REFERENCES objective_libraries(id) ON DELETE CASCADE,
      subject TEXT NOT NULL DEFAULT '',
      grade_level TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      cognitive_dimension TEXT NOT NULL DEFAULT 'understand',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      positioning TEXT NOT NULL DEFAULT '',
      audience_grade TEXT NOT NULL DEFAULT '',
      audience_age TEXT NOT NULL DEFAULT '',
      prior_level TEXT NOT NULL DEFAULT '',
      style TEXT NOT NULL DEFAULT 'academic',
      orientation TEXT NOT NULL DEFAULT 'portrait',
      target_word_count INTEGER DEFAULT 30000,
      target_page_count INTEGER DEFAULT 100,
      source TEXT NOT NULL DEFAULT 'aigc',
      source_file_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      summary TEXT,
      objective_ids TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      content TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      objective_ids TEXT NOT NULL DEFAULT '[]',
      page_number INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS paragraphs (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL,
      objective_ids TEXT NOT NULL DEFAULT '[]',
      source_tag TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skeletons (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      original_file_name TEXT NOT NULL,
      toc_json TEXT NOT NULL DEFAULT '[]',
      raw_content TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_units (
      id TEXT PRIMARY KEY,
      skeleton_id TEXT NOT NULL REFERENCES skeletons(id) ON DELETE CASCADE,
      chapter_title TEXT NOT NULL,
      section_title TEXT NOT NULL,
      core_concept TEXT NOT NULL,
      definition TEXT,
      examples TEXT NOT NULL DEFAULT '[]',
      difficulty TEXT NOT NULL DEFAULT 'medium',
      intent TEXT,
      objective_ids TEXT NOT NULL DEFAULT '[]',
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS illustrations (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      paragraph_id TEXT REFERENCES paragraphs(id) ON DELETE SET NULL,
      caption TEXT NOT NULL DEFAULT '',
      figure_number TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'ai-svg',
      url TEXT,
      svg_content TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      stem TEXT NOT NULL,
      options TEXT NOT NULL DEFAULT '[]',
      explanation TEXT NOT NULL DEFAULT '',
      objective_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS covers (
      book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
      subtitle TEXT NOT NULL DEFAULT '',
      author_line TEXT NOT NULL DEFAULT '',
      palette TEXT NOT NULL DEFAULT 'indigo',
      svg_content TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS adaptation_plans (
      book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
      audience_note TEXT NOT NULL DEFAULT '',
      pedagogy TEXT NOT NULL DEFAULT '',
      free_intent TEXT NOT NULL DEFAULT '',
      structured_intent TEXT NOT NULL DEFAULT '[]',
      confirmed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_nodes (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'user',
      content TEXT NOT NULL,
      scope TEXT,
      target_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // 增量迁移：功能元素配置（教学颗粒：互动练习/自动配图）
  try {
    db.exec(`ALTER TABLE sections ADD COLUMN elements TEXT NOT NULL DEFAULT '{"exercise":true,"illustration":false}'`)
  } catch { /* 列已存在 */ }
  // 增量迁移：小节教学要点（大纲层的内容脉络，生成正文前供老师确认）
  try {
    db.exec(`ALTER TABLE sections ADD COLUMN brief TEXT NOT NULL DEFAULT ''`)
  } catch { /* 列已存在 */ }
  // 增量迁移：正文脉络（教学颗粒序列，老师逐颗粒确认后才生成正文）
  try {
    db.exec(`ALTER TABLE sections ADD COLUMN block_plan TEXT NOT NULL DEFAULT '[]'`)
  } catch { /* 列已存在 */ }
  // 增量迁移：二创物化溯源——本节由原书哪个知识单元物化而来（用于删除↔小节联动）
  try {
    db.exec(`ALTER TABLE sections ADD COLUMN source_unit_id TEXT`)
  } catch { /* 列已存在 */ }
}
