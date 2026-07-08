// ─── Learning Objectives ──────────────────────────────────────────────────────

export type CognitiveDimension = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'

export interface LearningObjective {
  id: string
  library_id: string
  subject: string
  grade_level: string
  description: string
  cognitive_dimension: CognitiveDimension
  tags: string[]
}

export interface ObjectiveLibrary {
  id: string
  name: string
  subject: string
  grade_level: string
}

// ─── Book ─────────────────────────────────────────────────────────────────────

export type BookSource = 'aigc' | 'adaptation'
export type BookOrientation = 'portrait' | 'landscape'

export interface Book {
  id: string
  title: string
  topic: string
  positioning: string
  audience_grade: string
  audience_age: string
  prior_level: string
  style: string
  genre: string
  orientation: BookOrientation
  target_word_count: number
  target_page_count: number
  source: BookSource
  source_file_path?: string | null
  created_at: string
  updated_at: string
}

// ─── Chapter / Section ────────────────────────────────────────────────────────

export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'error'

export interface Chapter {
  id: string
  book_id: string
  order_index: number
  title: string
  summary: string | null
  objective_ids: string[]
  status: GenerationStatus
}

/** 功能元素配置：每节包含哪些教学颗粒 */
export interface SectionElements {
  exercise: boolean      // 互动练习
  illustration: boolean  // 自动配图
}

// ─── 正文脉络：教学颗粒序列（生成正文前老师逐颗粒确认）───────────────────────

export type BlockType = 'intro' | 'concept' | 'callout' | 'example' | 'figure' | 'summary' | 'exercise'

export interface ContentBlock {
  id: string
  type: BlockType
  desc: string      // 这个颗粒具体承载什么（一句话）
  enabled: boolean  // 老师的去留决定
}

export const BLOCK_TYPE_META: Record<BlockType, { label: string; emoji: string; cls: string }> = {
  intro:    { label: '情境导入', emoji: '🚪', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  concept:  { label: '核心概念', emoji: '📐', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  callout:  { label: '重点说明', emoji: '💡', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  example:  { label: '典型例题', emoji: '✏️', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  figure:   { label: '配图示意', emoji: '🖼', cls: 'bg-pink-50 text-pink-700 border-pink-200' },
  summary:  { label: '小结', emoji: '🎁', cls: 'bg-green-50 text-green-700 border-green-200' },
  exercise: { label: '互动练习', emoji: '🧩', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
}

export interface Section {
  id: string
  chapter_id: string
  book_id: string
  order_index: number
  title: string
  content: string | null
  status: GenerationStatus
  objective_ids: string[]
  page_number: number | null
  elements: SectionElements
  brief: string   // 教学要点：本节讲什么（大纲层，生成正文的依据）
  block_plan: ContentBlock[]  // 正文脉络：已确认的教学颗粒序列
  source_unit_id?: string | null  // 二创：本节由原书哪个知识单元物化而来（null=非物化/目标增补节）
}

// ─── 封面 ─────────────────────────────────────────────────────────────────────

export interface BookCover {
  book_id: string
  subtitle: string
  author_line: string
  palette: string
  svg_content: string | null
}

// ─── Paragraph ────────────────────────────────────────────────────────────────

export type SourceTag = 'rewritten' | 'generated' | 'teacher-specified'

export interface Paragraph {
  id: string
  section_id: string
  order_index: number
  content: string
  objective_ids: string[]
  source_tag: SourceTag | null
}

// ─── Route B ──────────────────────────────────────────────────────────────────

export interface KnowledgeUnit {
  id: string
  skeleton_id: string
  chapter_title: string
  section_title: string
  core_concept: string
  definition: string | null
  examples: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  intent: 'keep' | 'rewrite' | 'delete' | null
  objective_ids: string[]
}

export interface Skeleton {
  id: string
  book_id: string
  original_file_name: string
  toc_json: string
  created_at: string
}

export interface AlignmentEntry {
  objective_id: string
  status: 'covered' | 'gap' | 'redundant' | 'misaligned'
  unit_ids: string[]
  notes: string | null
}

// ─── Illustration ─────────────────────────────────────────────────────────────

export type IllustrationSource = 'ai-generated' | 'ai-svg' | 'uploaded'

export interface Illustration {
  id: string
  section_id: string
  paragraph_id: string | null
  caption: string
  figure_number: string
  source: IllustrationSource
  url: string | null
  svg_content: string | null
}

// ─── Question ─────────────────────────────────────────────────────────────────

export interface QuestionOption {
  label: string
  text: string
  is_correct: boolean
}

export interface Question {
  id: string
  section_id: string
  stem: string
  options: QuestionOption[]
  explanation: string
  objective_ids: string[]
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type ChatScope = 'toc' | 'chapter' | 'section' | 'paragraph'

export interface ChatNode {
  id: string
  book_id: string
  role: 'user' | 'assistant'
  content: string
  scope: ChatScope | null
  target_id: string | null
  created_at: string
}
