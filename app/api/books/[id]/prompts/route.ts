import { NextRequest, NextResponse } from 'next/server'
import { getBook, getChapters, getSections } from '@/lib/db/queries/books'
import { getObjectivesByIds } from '@/lib/db/queries/objectives'
import { getSkeleton, getKnowledgeUnits } from '@/lib/db/queries/skeletons'
import type { Book, Chapter, Section, LearningObjective } from '@/types'

import { buildPositioningSystem, buildPositioningPrompt, buildDraftObjectivesSystem, buildDraftObjectivesPrompt } from '@/lib/prompts/draft'
import { buildParseBookSystem, buildParseBookPrompt } from '@/lib/prompts/parse'
import { buildTocSystem, buildTocPrompt } from '@/lib/prompts/toc'
import { buildAlignSystem, buildAlignPrompt } from '@/lib/prompts/align'
import { buildSectionPlanSystem, buildSectionPlanPrompt } from '@/lib/prompts/section-plan'
import { buildSectionSystem, buildSectionPrompt, buildRegeneratePrompt } from '@/lib/prompts/section'
import { buildQuestionsSystem, buildQuestionsPrompt } from '@/lib/prompts/questions'
import { buildIllustrationSystem, buildIllustrationPrompt } from '@/lib/prompts/illustration'
import { buildChatSystem, buildChatPrompt } from '@/lib/prompts/chat'
import { buildCoverSystem, buildCoverPrompt } from '@/lib/prompts/cover'
import { buildIntentParseSystem, buildIntentParsePrompt } from '@/lib/prompts/adaptation'

const MODEL = 'claude-sonnet-4-6'

// 输入型节点没有落库数据可填，用这些示例填充并在 UI 标注「示例输入」
const EX_NEED = '做一个给大学生用的生物课本'
const EX_MODULES = [
  { name: '细胞与分子基础', desc: '水、有机大分子的结构与功能，细胞的基本组成' },
  { name: '遗传与信息', desc: 'DNA 复制、转录翻译、基因调控' },
]
const EX_TEXT = '（此处为你上传的教材文本前 8000 字。示例：第一章 函数……）'
const EX_INTENT = '我希望每章都从一个真实问题开始；把第二章的证明改成探究式引导。'
const EX_PARA = '核心概念的严格定义：在给定条件下，对象之间的对应关系满足确定性与唯一性。'
const EX_MSG = '把第二章拆成两章'

function exampleObjectives(): LearningObjective[] {
  return [
    { id: 'obj-example-1', library_id: '', subject: '', grade_level: '', description: '能准确陈述核心概念的定义并辨析常见误区', cognitive_dimension: 'understand', tags: [] },
    { id: 'obj-example-2', library_id: '', subject: '', grade_level: '', description: '能运用基本性质对简单情形进行推导', cognitive_dimension: 'apply', tags: [] },
  ]
}

interface PromptNode {
  id: string; title: string; stage: string; fires: string; route: string
  system: string; user: string; real: boolean; note?: string
}

/**
 * 提示词检查器数据源：把全部 AI 节点的「系统提示 + 用户提示」用这本书的真实数据填好返回。
 * 输入型节点（起草/解析/意图/对话）无落库数据 → 用示例填充并标 real=false。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const book = getBook(id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const chapters = getChapters(id)
  const sections = getSections(id)
  const sectionsByChapter: Record<string, Section[]> = {}
  for (const c of chapters) sectionsByChapter[c.id] = sections.filter(s => s.chapter_id === c.id)

  // 取一个样本章/节，尽量填真实数据
  const sampleSection: Section | undefined = sections.find(s => s.objective_ids.length) ?? sections[0]
  const sampleChapter: Chapter | undefined = sampleSection ? chapters.find(c => c.id === sampleSection.chapter_id) : chapters[0]
  const sampleObjs = sampleSection ? getObjectivesByIds(sampleSection.objective_ids) : []
  const secObjs = sampleObjs.length ? sampleObjs : exampleObjectives()

  // 全书覆盖目标（toc 用）
  const allObjIds = [...new Set([...chapters.flatMap(c => c.objective_ids), ...sections.flatMap(s => s.objective_ids)])]
  const bookObjs = allObjIds.length ? getObjectivesByIds(allObjIds) : exampleObjectives()

  // 知识单元（改编书才有）
  const skeleton = getSkeleton(id)
  const units = skeleton ? getKnowledgeUnits(skeleton.id) : []
  const sampleUnits = units.slice(0, 3)

  const secStub = (sampleSection ?? { title: '1.1 示例小节', brief: '本节讲解核心概念的定义与辨析' }) as Section
  const chapStub = (sampleChapter ?? { title: '第一章 示例章', summary: '本章建立核心概念' }) as Chapter

  const nodes: PromptNode[] = [
    // ── 起草与解析 ──
    {
      id: 'draft-positioning', stage: '起草与解析', title: '① 一句话 → 定位方案卡',
      fires: '从零起草向导第①步「AI 起草定位方案」', route: 'POST /api/ai/draft-positioning',
      system: buildPositioningSystem(), user: buildPositioningPrompt(EX_NEED), real: false,
      note: '输入是你的一句话需求（此处为示例）。产出书名/受众/覆盖模块。',
    },
    {
      id: 'draft-objectives', stage: '起草与解析', title: '② 覆盖模块 → 学习目标',
      fires: '从零起草向导第②步「范围确认，生成学习目标」', route: 'POST /api/ai/draft-objectives',
      system: buildDraftObjectivesSystem(),
      user: buildDraftObjectivesPrompt(book.topic || '大学生物学', { grade: book.audience_grade, age: book.audience_age, prior: book.prior_level }, EX_MODULES),
      real: false, note: '模块来自上一步确认结果（此处为示例）。目标先于大纲生成，自动入库。',
    },
    {
      id: 'parse-book', stage: '起草与解析', title: '线路B 导入解析（四层解构）',
      fires: '线路B 上传教材 → 导入解析', route: 'POST /api/ai/parse-book',
      system: buildParseBookSystem(), user: buildParseBookPrompt(EX_TEXT, '示例教材.pdf'), real: false,
      note: '输入是你上传文件提取的前 8000 字（此处为示例占位）。',
    },
    // ── 大纲与目标 ──
    {
      id: 'generate-toc', stage: '大纲与目标', title: '教学大纲 / 目录生成',
      fires: '目录设计阶段「生成目录」（NDJSON 流式逐章）', route: 'POST /api/ai/generate-toc',
      system: buildTocSystem(), user: buildTocPrompt(book, bookObjs), real: allObjIds.length > 0,
      note: '用勾选的学习目标 + 本书信息生成；objective_idx 把目标挂到章节。',
    },
    {
      id: 'align-objectives', stage: '大纲与目标', title: '目标覆盖矩阵分析',
      fires: '线路B 目标增补「运行覆盖度分析」', route: 'POST /api/ai/align-objectives',
      system: buildAlignSystem(),
      user: buildAlignPrompt(sampleUnits.length ? sampleUnits : [{ id: 'unit-ex', core_concept: '示例知识单元', definition: '示例定义' }], bookObjs),
      real: sampleUnits.length > 0, note: '把原书知识单元与目标库对齐，找出覆盖缺口/冗余。',
    },
    // ── 正文 ──
    {
      id: 'section-plan', stage: '正文', title: '正文脉络设计（教学颗粒序列）',
      fires: '正文页「AI 设计正文脉络」', route: 'POST /api/ai/section-plan',
      system: buildSectionPlanSystem(), user: buildSectionPlanPrompt(secStub, chapStub.title, secObjs, book), real: !!sampleSection,
      note: '产出 intro/concept/example… 颗粒序列，供你逐颗粒确认去留。',
    },
    {
      id: 'generate-section', stage: '正文', title: '正文生成（纯生成）',
      fires: '正文页「确认脉络生成正文」/ 批量生成', route: 'POST /api/ai/generate-section',
      system: buildSectionSystem(book), user: buildSectionPrompt(chapStub, secStub, secObjs, sampleUnits, book), real: !!sampleSection,
      note: '含体裁契约注入 + 段落标记协议 <!--m o=目标 s=来源-->。',
    },
    {
      id: 'generate-section-regen', stage: '正文', title: '正文生成（改编书 regenerate）',
      fires: '改编书生成正文时自动走此分支', route: 'POST /api/ai/generate-section',
      system: buildSectionSystem(book),
      user: buildRegeneratePrompt(chapStub, secStub, secObjs, sampleUnits, EX_INTENT, '原书面向大学生，改编为高中生', '案例驱动'),
      real: !!sampleSection, note: '强调「改的是骨架，原文只是素材」，按 keep/rewrite 分别处理，老师意图标 teacher-specified。',
    },
    {
      id: 'questions', stage: '正文', title: '随堂练习出题',
      fires: '段落「对本段出题」/ 生成练习', route: 'POST /api/ai/questions',
      system: buildQuestionsSystem(), user: buildQuestionsPrompt(secStub.title, secStub.content ?? EX_PARA, secObjs, 4), real: !!sampleSection,
      note: '按学习目标定向出单选题，每题标注考察的目标 id。',
    },
    {
      id: 'illustration', stage: '正文', title: 'AI 配图（生成 SVG）',
      fires: '段落/选区「AI 配图」/ 图占位「AI 生成」', route: 'POST /api/ai/illustration',
      system: buildIllustrationSystem(), user: buildIllustrationPrompt(EX_PARA, secStub.title, '图1.1'), real: false,
      note: '让模型直接画 SVG 矢量图（非文生图位图）。prompt 用段落或选中文字。',
    },
    // ── 辅助 ──
    {
      id: 'chat', stage: '辅助', title: 'AI 主编对话',
      fires: '右侧「主编」面板下指令', route: 'POST /api/ai/chat',
      system: buildChatSystem(book), user: buildChatPrompt(EX_MSG, chapters, sectionsByChapter, undefined, sampleSection ? { title: secStub.title, paragraphs: [] } : null),
      real: chapters.length > 0, note: '把指令解析为 {scope,reply,operations}，服务端执行改库（大纲/章节/段落/删图）。',
    },
    {
      id: 'cover', stage: '辅助', title: '封面主视觉生成',
      fires: '封面编辑「AI 生成封面主视觉」', route: 'PUT /api/cover (generate_art)',
      system: buildCoverSystem(), user: buildCoverPrompt(book), real: true,
      note: '输出纯 SVG（无文字）作为封面插画。',
    },
    {
      id: 'adaptation-intent', stage: '辅助', title: '自由意图 → 结构化改编指令',
      fires: '线路B 改编设置「解析为结构化指令」', route: 'PUT /api/adaptation-plan (parse_intent)',
      system: buildIntentParseSystem(), user: buildIntentParsePrompt(EX_INTENT), real: false,
      note: '把老师的自然语言改编意图转成 3-6 条结构化指令回显。',
    },
  ]

  return NextResponse.json({ book: { title: book.title, genre: book.genre, style: book.style }, model: MODEL, nodes })
}
