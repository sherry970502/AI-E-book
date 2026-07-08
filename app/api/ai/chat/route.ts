import { NextRequest, NextResponse } from 'next/server'
import { callClaude, parseJSON } from '@/lib/ai'
import { buildChatSystem, buildChatPrompt } from '@/lib/prompts/chat'
import {
  getBook, getChapters, getSection, getSectionsByChapter, createChapter, createSection,
  deleteChapter, deleteSection, updateChapter, updateSection, updateSectionElements,
  normalizeChapterOrder, normalizeSectionOrder,
} from '@/lib/db/queries/books'
import {
  getParagraphs, createParagraph, updateParagraphContent, deleteParagraph, renumberParagraphs,
} from '@/lib/db/queries/paragraphs'
import { getIllustrationsBySection, deleteIllustration } from '@/lib/db/queries/illustrations'
import { addChatNode } from '@/lib/db/queries/chat'
import { getDb } from '@/lib/db'
import { randomUUID } from 'crypto'
import type { Chapter, Section } from '@/types'

/**
 * 节点式主编对话：指令 → {scope, reply, operations} → 服务端执行 → 返回执行结果。
 * 前端收到 applied 非空时刷新看板（无需手动操作，验收硬指标②）。
 */

interface ChatOp {
  op: string
  chapter?: number
  section?: number
  title?: string
  summary?: string
  brief?: string
  after?: number
  exercise?: boolean
  illustration?: boolean
  // 段落/插图级操作（作用于用户当前正在看的节）
  paragraph?: number
  content?: string
  figure?: number
}

// 这些操作改的是当前节的正文内容 → 执行后前端需重取本节
const SECTION_CONTENT_OPS = new Set(['edit_paragraph', 'insert_paragraph', 'delete_paragraph', 'delete_illustration'])
interface ChatResult { scope: string; reply: string; operations: ChatOp[] }

export async function POST(req: NextRequest) {
  const { bookId, message, context, sectionId } = await req.json()
  const book = getBook(bookId)
  if (!book) return NextResponse.json({ error: 'book not found' }, { status: 404 })

  const chapters = getChapters(bookId)
  const sectionsByChapter: Record<string, Section[]> = {}
  for (const c of chapters) sectionsByChapter[c.id] = getSectionsByChapter(c.id)

  // 用户当前翻到的正文页 → 段落全文+插图清单进上下文，主编才能执行段落/插图级修改
  const curSection = sectionId ? getSection(sectionId) : null
  const curParagraphs = curSection ? getParagraphs(curSection.id) : []
  const curIllustrations = curSection ? getIllustrationsBySection(curSection.id) : []

  addChatNode({ id: randomUUID(), book_id: bookId, role: 'user', content: message, scope: null, target_id: null })

  let result: ChatResult
  if (!process.env.ANTHROPIC_API_KEY) {
    result = mockParseInstruction(message, chapters, sectionsByChapter, curParagraphs.length, curIllustrations.length)
  } else {
    const raw = await callClaude(
      [{ role: 'user', content: buildChatPrompt(message, chapters, sectionsByChapter, context,
        curSection ? { title: curSection.title, paragraphs: curParagraphs, illustrations: curIllustrations } : null) }],
      buildChatSystem(book),
      3000
    )
    result = parseJSON<ChatResult>(raw, { scope: 'none', reply: raw, operations: [] })
  }

  // ── 执行操作 ──
  const applied: string[] = []
  const errors: string[] = []
  let paragraphChanged = false
  // 删除操作先按序号降序执行，避免序号漂移
  const ops = [...(result.operations ?? [])].sort((a, b) => {
    const del = (o: ChatOp) => o.op.startsWith('delete') ? 1 : 0
    if (del(a) !== del(b)) return del(b) - del(a)
    return (b.chapter ?? 0) - (a.chapter ?? 0) || (b.paragraph ?? 0) - (a.paragraph ?? 0)
  })

  for (const op of ops) {
    try {
      const desc = applyOp(bookId, op, curSection?.id)
      if (desc) {
        applied.push(desc)
        if (SECTION_CONTENT_OPS.has(op.op)) paragraphChanged = true
      }
    } catch (e) {
      errors.push(`${op.op} 失败：${e instanceof Error ? e.message : '未知'}`)
    }
  }
  if (applied.length) {
    normalizeChapterOrder(bookId)
    for (const c of getChapters(bookId)) normalizeSectionOrder(c.id)
  }

  addChatNode({
    id: randomUUID(), book_id: bookId, role: 'assistant',
    content: result.reply, scope: result.scope === 'none' ? null : (result.scope as import('@/types').ChatScope),
    target_id: null,
  })

  return NextResponse.json({
    reply: result.reply,
    scope: result.scope,
    applied,
    errors,
    refresh: applied.length > 0,
    refreshSection: paragraphChanged,  // 段落有改动 → 前端重取当前节正文
  })
}

function applyOp(bookId: string, op: ChatOp, curSectionId?: string): string | null {
  // 每次执行前重取最新目录（前序操作可能已改变结构）
  const chapters = getChapters(bookId)
  const ch = op.chapter ? chapters[op.chapter - 1] : undefined

  switch (op.op) {
    case 'delete_chapter': {
      if (!ch) throw new Error(`第${op.chapter}章不存在`)
      deleteChapter(ch.id)
      return `删除了「${ch.title}」`
    }
    case 'add_chapter': {
      const after = op.after ?? chapters.length
      const chapter = createChapter({
        id: randomUUID(), book_id: bookId,
        order_index: after - 0.5 + 1,  // 插在 after 章之后（重排前的临时序号）
        title: op.title ?? '新章节', summary: op.summary ?? null,
        objective_ids: [], status: 'pending',
      })
      // 用小数序号占位，normalize 时归整
      updateChapterOrderFloat(chapter.id, after + 0.5)
      return `新增章「${op.title}」`
    }
    case 'rename_chapter': {
      if (!ch) throw new Error(`第${op.chapter}章不存在`)
      updateChapter(ch.id, { title: op.title })
      return `「${ch.title}」改名为「${op.title}」`
    }
    case 'set_summary': {
      if (!ch) throw new Error(`第${op.chapter}章不存在`)
      updateChapter(ch.id, { summary: op.summary })
      return `更新了「${ch.title}」的概述`
    }
    case 'add_section': {
      if (!ch) throw new Error(`第${op.chapter}章不存在`)
      const secs = getSectionsByChapter(ch.id)
      createSection({
        id: randomUUID(), chapter_id: ch.id, book_id: bookId,
        order_index: secs.length, title: op.title ?? '新小节',
        content: null, status: 'pending', objective_ids: [], page_number: null,
      })
      return `在「${ch.title}」新增小节「${op.title}」`
    }
    case 'delete_section': {
      if (!ch) throw new Error(`第${op.chapter}章不存在`)
      const secs = getSectionsByChapter(ch.id)
      const sec = op.section ? secs[op.section - 1] : undefined
      if (!sec) throw new Error(`第${op.chapter}章第${op.section}节不存在`)
      deleteSection(sec.id)
      return `删除了「${sec.title}」`
    }
    case 'rename_section': {
      if (!ch) throw new Error(`第${op.chapter}章不存在`)
      const secs = getSectionsByChapter(ch.id)
      const sec = op.section ? secs[op.section - 1] : undefined
      if (!sec) throw new Error(`第${op.chapter}章第${op.section}节不存在`)
      updateSection(sec.id, { title: op.title })
      return `「${sec.title}」改名为「${op.title}」`
    }
    case 'set_brief': {
      if (!ch) throw new Error(`第${op.chapter}章不存在`)
      const secs = getSectionsByChapter(ch.id)
      const sec = op.section ? secs[op.section - 1] : undefined
      if (!sec) throw new Error(`第${op.chapter}章第${op.section}节不存在`)
      updateSection(sec.id, { brief: op.brief ?? '' })
      return `更新了「${sec.title}」的教学要点`
    }
    case 'set_elements': {
      const elements: Record<string, boolean> = {}
      if (op.exercise !== undefined) elements.exercise = op.exercise
      if (op.illustration !== undefined) elements.illustration = op.illustration
      if (!Object.keys(elements).length) return null
      // 作用范围：指定节 / 整章 / 全书
      let targets: string[] = []
      let scopeDesc = ''
      if (ch && op.section) {
        const sec = getSectionsByChapter(ch.id)[op.section - 1]
        if (!sec) throw new Error(`第${op.chapter}章第${op.section}节不存在`)
        targets = [sec.id]; scopeDesc = `「${sec.title}」`
      } else if (ch) {
        targets = getSectionsByChapter(ch.id).map(s => s.id); scopeDesc = `「${ch.title}」全部小节`
      } else {
        targets = chapters.flatMap(c => getSectionsByChapter(c.id).map(s => s.id)); scopeDesc = '全书所有小节'
      }
      for (const id of targets) updateSectionElements(id, elements)
      const parts = []
      if (elements.exercise !== undefined) parts.push(`互动练习${elements.exercise ? '开启' : '关闭'}`)
      if (elements.illustration !== undefined) parts.push(`自动配图${elements.illustration ? '开启' : '关闭'}`)
      return `${scopeDesc}：${parts.join('、')}`
    }
    // ── 段落级操作：作用于用户当前正在看的节；改动一律标记「老师指定」进来源审计 ──
    case 'edit_paragraph': {
      const paras = requireParagraphs(curSectionId)
      const p = op.paragraph ? paras[op.paragraph - 1] : undefined
      if (!p) throw new Error(`本节没有第${op.paragraph}段（共${paras.length}段）`)
      if (!op.content?.trim()) throw new Error('缺少改写后的段落内容')
      updateParagraphContent(p.id, op.content.trim(), 'teacher-specified')
      return `改写了本节第${op.paragraph}段`
    }
    case 'insert_paragraph': {
      if (!curSectionId) throw new Error('当前不在正文页，无法定位段落')
      const paras = getParagraphs(curSectionId)
      if (!op.content?.trim()) throw new Error('缺少新段落内容')
      const after = Math.max(0, Math.min(op.after ?? paras.length, paras.length))
      createParagraph({
        id: randomUUID(), section_id: curSectionId,
        // 小数占位插到 after 段之后，renumber 时归整
        order_index: (paras[after - 1]?.order_index ?? -1) + 0.5,
        content: op.content.trim(), objective_ids: [], source_tag: 'teacher-specified',
      })
      renumberParagraphs(curSectionId)
      return after === 0 ? '在本节开头插入了新段落' : `在本节第${after}段之后插入了新段落`
    }
    case 'delete_paragraph': {
      const paras = requireParagraphs(curSectionId)
      const p = op.paragraph ? paras[op.paragraph - 1] : undefined
      if (!p) throw new Error(`本节没有第${op.paragraph}段（共${paras.length}段）`)
      deleteParagraph(p.id)
      renumberParagraphs(curSectionId!)
      return `删除了本节第${op.paragraph}段`
    }
    case 'delete_illustration': {
      if (!curSectionId) throw new Error('当前不在正文页，无法定位插图')
      const ils = getIllustrationsBySection(curSectionId)
      const il = op.figure ? ils[op.figure - 1] : undefined
      if (!il) throw new Error(`本节没有第${op.figure}张插图（共${ils.length}张）`)
      deleteIllustration(il.id)
      return `删除了插图 ${il.figure_number}「${il.caption}」`
    }
    default:
      return null
  }
}

function requireParagraphs(curSectionId?: string) {
  if (!curSectionId) throw new Error('当前不在正文页，无法定位段落')
  const paras = getParagraphs(curSectionId)
  if (!paras.length) throw new Error('本节还没有正文，请先生成')
  return paras
}

function updateChapterOrderFloat(id: string, order: number) {
  getDb().prepare(`UPDATE chapters SET order_index = ? WHERE id = ?`).run(order, id)
}

// ─── Mock 指令解析器（无 API key 时支持常见结构指令）──────────────────────────

const CN_NUM: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
function toNum(s: string): number {
  const n = parseInt(s, 10)
  if (!isNaN(n)) return n
  return CN_NUM[s] ?? 0
}

function mockParseInstruction(
  message: string,
  chapters: Chapter[],
  sectionsByChapter: Record<string, Section[]>,
  paragraphCount = 0,
  illustrationCount = 0
): ChatResult {
  // 插图级：删除第 N 张图 / 删除图N
  const im = message.match(/删(?:除|掉)(?:本节)?(?:第([一二两三四五六七八九十\d]+)张)?(?:插?图)(?:([一二两三四五六七八九十\d]+))?/)
  if (im && (im[1] || im[2]) && illustrationCount > 0) {
    const n = toNum(im[1] || im[2])
    if (n >= 1 && n <= illustrationCount) {
      return {
        scope: 'paragraph',
        reply: `（Mock 主编）已删除本节第${n}张插图。`,
        operations: [{ op: 'delete_illustration', figure: n }],
      }
    }
  }
  // 段落级：把第 N 段改为/改成：xxx（当前正文页内）
  let pm = message.match(/(?:把|将)?第([一二两三四五六七八九十\d]+)段.*?(?:改为|改成|替换为)\s*[：:「"']?\s*([\s\S]+?)[」"']?\s*$/)
  if (pm && paragraphCount > 0) {
    const n = toNum(pm[1])
    if (n >= 1 && n <= paragraphCount) {
      return {
        scope: 'paragraph',
        reply: `（Mock 主编）已把本节第${pm[1]}段替换为你给出的内容，并标记为「老师指定」。`,
        operations: [{ op: 'edit_paragraph', paragraph: n, content: pm[2] }],
      }
    }
  }
  // 段落级：删除第 N 段
  pm = message.match(/删(?:除|掉)(?:本节)?第([一二两三四五六七八九十\d]+)段/)
  if (pm && paragraphCount > 0) {
    const n = toNum(pm[1])
    if (n >= 1 && n <= paragraphCount) {
      return {
        scope: 'paragraph',
        reply: `（Mock 主编）已删除本节第${pm[1]}段。`,
        operations: [{ op: 'delete_paragraph', paragraph: n }],
      }
    }
  }
  // 缩减为 N 章
  let m = message.match(/(?:缩减|精简|压缩|保留).*?([一二两三四五六七八九十\d]+)\s*章/)
  if (m) {
    const keep = toNum(m[1])
    if (keep > 0 && keep < chapters.length) {
      const ops: ChatOp[] = []
      for (let i = chapters.length; i > keep; i--) ops.push({ op: 'delete_chapter', chapter: i })
      return {
        scope: 'outline',
        reply: `（Mock 主编）好的，我把大纲缩减为最核心的 ${keep} 章，删除了后面 ${chapters.length - keep} 章。看板已刷新。`,
        operations: ops,
      }
    }
  }
  // 删除第 N 章
  m = message.match(/删(?:除|掉)第([一二两三四五六七八九十\d]+)章/)
  if (m) {
    const n = toNum(m[1])
    if (n >= 1 && n <= chapters.length) {
      return { scope: 'outline', reply: `（Mock 主编）已删除第${m[1]}章「${chapters[n - 1].title}」。`, operations: [{ op: 'delete_chapter', chapter: n }] }
    }
  }
  // 在第 N 章增加小节 XXX
  m = message.match(/(?:在|给)?第([一二两三四五六七八九十\d]+)章.*?(?:增加|新增|加|添加).*?小节.*?[「"'：:]\s*(.+?)[」"']?\s*$/)
  if (m) {
    const n = toNum(m[1])
    if (n >= 1 && n <= chapters.length) {
      const secCount = (sectionsByChapter[chapters[n - 1].id] ?? []).length
      const title = `${n}.${secCount + 1} ${m[2]}`
      return { scope: 'chapter', reply: `（Mock 主编）已在「${chapters[n - 1].title}」下新增小节「${title}」，状态 Pending，可随时生成正文。`, operations: [{ op: 'add_section', chapter: n, title }] }
    }
  }
  // 增加一章
  m = message.match(/(?:增加|新增|加|添加).*?一?章.*?[「"'：:]\s*(.+?)[」"']?\s*$/)
  if (m) {
    return { scope: 'outline', reply: `（Mock 主编）已在书末新增一章「${m[1]}」。`, operations: [{ op: 'add_chapter', title: `第${chapters.length + 1}章 ${m[1]}`, summary: '', after: chapters.length }] }
  }
  // 功能元素：给第N章/全书 开启/关闭 练习/配图
  m = message.match(/(?:给|为)?(全书|整本书|第([一二两三四五六七八九十\d]+)章)?.*?(开启|关闭|加上?|去掉|取消).*?(互动练习|练习|自动配图|配图)/)
  if (m && /练习|配图/.test(message)) {
    const isOn = /开启|加/.test(m[3])
    const key = /配图/.test(m[4]) ? 'illustration' : 'exercise'
    const chNum = m[2] ? toNum(m[2]) : undefined
    if (!m[1] || m[1] === '全书' || m[1] === '整本书' || (chNum && chNum >= 1 && chNum <= chapters.length)) {
      const scopeDesc = chNum ? `第${m[2]}章` : '全书'
      return {
        scope: chNum ? 'chapter' : 'outline',
        reply: `（Mock 主编）已为${scopeDesc}${isOn ? '开启' : '关闭'}${key === 'exercise' ? '互动练习' : '自动配图'}。批量生成正文时会按此配置自动${key === 'exercise' ? '出题' : '配图'}。`,
        operations: [{ op: 'set_elements', chapter: chNum, [key]: isOn }],
      }
    }
  }
  // 第 N 章改名
  m = message.match(/第([一二两三四五六七八九十\d]+)章.*?(?:改名|重命名|改为|改成).*?[「"'：:]\s*(.+?)[」"']?\s*$/)
  if (m) {
    const n = toNum(m[1])
    if (n >= 1 && n <= chapters.length) {
      return { scope: 'outline', reply: `（Mock 主编）已将第${m[1]}章改名为「${m[2]}」。`, operations: [{ op: 'rename_chapter', chapter: n, title: m[2] }] }
    }
  }

  return {
    scope: 'none',
    reply: `（Mock 主编）我理解你的想法。当前无 API Key，我能执行的指令示例：「把大纲缩减为最核心的四章」「删除第二章」「在第一章增加小节：函数的图像」「增加一章：综合复习」「第三章改名：进阶应用」；翻到正文页后还有「把第二段改为：……」「删除第三段」。配置 API Key 后可自由表达任何修改意图。`,
    operations: [],
  }
}
