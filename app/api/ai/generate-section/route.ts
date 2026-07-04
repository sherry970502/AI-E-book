import { NextRequest } from 'next/server'
import { streamClaude } from '@/lib/ai'
import { buildSectionSystem, buildSectionPrompt, buildRegeneratePrompt } from '@/lib/prompts/section'
import { getBook, getSection, updateSectionContent, getChapters } from '@/lib/db/queries/books'
import { getKnowledgeUnits, getSkeleton } from '@/lib/db/queries/skeletons'
import { getObjectivesByIds } from '@/lib/db/queries/objectives'
import { getAdaptationPlan } from '@/lib/db/queries/adaptation'
import { structureSectionContent } from '@/lib/paragraph-structurer'
import type { Chapter, LearningObjective } from '@/types'

export async function POST(req: NextRequest) {
  const { sectionId, mode = 'generate', intent, audienceNote, pedagogy } = await req.json()

  const section = getSection(sectionId)
  if (!section) return new Response('section not found', { status: 404 })
  const book = getBook(section.book_id)
  if (!book) return new Response('book not found', { status: 404 })

  const chapters = getChapters(section.book_id)
  const chapter = chapters.find((c: Chapter) => c.id === section.chapter_id)!
  const objectives = getObjectivesByIds(section.objective_ids)

  const skeleton = getSkeleton(section.book_id)
  const units = skeleton
    ? getKnowledgeUnits(skeleton.id).filter(u =>
        u.chapter_title === chapter.title || u.section_title === section.title)
    : []

  const isRegen = mode === 'regenerate' || book.source === 'adaptation'
  // 改编书：自动带上老师确认过的改编方案卡
  const plan = isRegen ? getAdaptationPlan(section.book_id) : null
  const mergedIntent = [intent, plan?.free_intent, ...(plan?.structured_intent ?? [])].filter(Boolean).join('；')
  const prompt = isRegen
    ? buildRegeneratePrompt(chapter, section, objectives, units,
        mergedIntent, audienceNote ?? plan?.audience_note ?? '', pedagogy ?? plan?.pedagogy ?? '')
    : buildSectionPrompt(chapter, section, objectives, units)

  const encoder = new TextEncoder()
  const MARKER_RE = /<!--m[\s\S]*?-->/g

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''
      try {
        if (!process.env.ANTHROPIC_API_KEY) {
          const mock = section.block_plan?.some(b => b.enabled)
            ? buildMockContentFromPlan(section, chapter.title, objectives, isRegen)
            : buildMockContent(section.title, chapter.title, objectives, isRegen)
          // 流式输出时剥掉标记（读者不该看到协议细节）
          for (const char of mock.replace(MARKER_RE, '')) {
            controller.enqueue(encoder.encode(char))
            await new Promise(r => setTimeout(r, 3))
          }
          fullContent = mock
        } else {
          let pending = ''
          await streamClaude(
            [{ role: 'user', content: prompt }],
            buildSectionSystem(book),
            (chunk) => {
              fullContent += chunk
              pending += chunk
              // 只推送已确认不含半截标记的部分
              const safeEnd = pending.lastIndexOf('<!--') === -1
                ? pending.length
                : pending.lastIndexOf('<!--')
              const out = pending.slice(0, safeEnd).replace(MARKER_RE, '')
              if (out) controller.enqueue(encoder.encode(out))
              pending = pending.slice(safeEnd).replace(MARKER_RE, '')
            },
            6000
          )
          if (pending.replace(MARKER_RE, '')) {
            controller.enqueue(encoder.encode(pending.replace(MARKER_RE, '')))
          }
        }

        // 结构化入库：段落行（目标 + sourceTag）+ 干净正文
        const clean = structureSectionContent(
          sectionId, fullContent, objectives, isRegen ? 'rewritten' : 'generated')
        updateSectionContent(sectionId, clean)
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[生成出错：${err instanceof Error ? err.message : '未知'}]`))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' },
  })
}

/** Mock 按老师确认的脉络逐颗粒拼装——切掉「重点说明」就真的不出现，所见即所得 */
function buildMockContentFromPlan(
  section: { title: string; block_plan: { type: string; desc: string; enabled: boolean }[] },
  chapterTitle: string,
  objectives: LearningObjective[],
  isRegen: boolean
) {
  const o = (i: number) => objectives.length ? `o=${(i % objectives.length) + 1}` : 'o='
  const s = (tag: string) => isRegen ? tag : 'generated'
  const parts: string[] = []
  let i = 0
  for (const b of section.block_plan.filter(x => x.enabled)) {
    i++
    switch (b.type) {
      case 'intro':
        parts.push(`【情境导入】${b.desc}——想象这样一个场景：你每天用一卡通刷卡吃饭，每一次刷卡（输入）都对应唯一一笔扣款（输出）。这背后正是「${section.title}」要研究的对应关系。\n<!--m ${o(i)} s=${s('rewritten')}-->`)
        break
      case 'concept':
        parts.push(`### 核心概念\n\n${b.desc}。**核心概念**的严格定义：在给定条件下，对象之间的对应关系满足**确定性**与**唯一性**两个要件。\n<!--m ${o(i)} s=${s('rewritten')}-->`)
        break
      case 'callout':
        parts.push(`> ${b.desc}：初学者常把「对应」误解为「相等」——二者有本质区别。一旦失去唯一性，后续推理的根基都会动摇。\n<!--m ${o(i)} s=${s('generated')}-->`)
        break
      case 'example':
        parts.push(`### 典型例题\n\n**例**（${b.desc}）：给定条件 A 与 B，判断是否满足核心概念的定义。\n\n解：①审题——明确已知与未知；②建模——检查确定性；③求解——验证唯一性；④回顾——结论与理由。\n<!--m ${o(i)} s=${s('generated')}-->`)
        break
      case 'figure':
        parts.push(`[图：${b.desc}]\n<!--m ${o(i)} s=${s('generated')}-->`)
        break
      case 'summary':
        parts.push(`### 小结\n\n${b.desc}。本节从直观出发建立了核心概念并辨析误区，下一节将在此基础上探讨其性质。\n<!--m ${o(i)} s=${s('teacher-specified')}-->`)
        break
      // exercise 颗粒不产正文——由出题引擎按目标定向生成
    }
  }
  return parts.join('\n\n')
}

function buildMockContent(sectionTitle: string, chapterTitle: string, objectives: LearningObjective[], isRegen: boolean) {
  const o1 = objectives.length >= 1 ? 'o=1' : 'o='
  const o2 = objectives.length >= 2 ? 'o=2' : o1
  const s = (tag: string) => isRegen ? tag : 'generated'
  return `本节我们进入「${sectionTitle}」的学习。在${chapterTitle}的整体脉络中，这一节承担着承上启下的作用——先从一个直观的问题出发，逐步建立起严谨的概念体系。
<!--m ${o1} s=${s('rewritten')}-->

### 核心概念

**核心概念**是理解本节内容的钥匙。它的严格定义如下：在给定条件下，对象之间的对应关系满足确定性与唯一性。初学者常见的误区是把「对应」理解成「相等」，这两者有本质区别。
<!--m ${o1} s=${s('rewritten')}-->

> 深入分析：为什么定义中强调「唯一性」？因为一旦失去唯一性，后续所有推理的根基都会动摇。这正是数学定义精确性的价值所在。
<!--m ${o2} s=${s('generated')}-->

### 典型例题

**例 1**：给定条件 A 与 B，判断二者是否满足核心概念的定义。

解题思路：第一步，检查确定性条件；第二步，验证唯一性；第三步，给出结论并说明理由。

[图：核心概念的对应关系示意图]
<!--m ${o2} s=${s('generated')}-->

按照老师的教学要求，这里特别补充一个贴近生活的案例：以校园一卡通的消费记录为例，每一次刷卡（输入）都对应唯一一笔扣款（输出）——这正是核心概念在真实世界的投影。
<!--m ${o1} s=${s('teacher-specified')}-->

### 小结

本节从直观出发建立了核心概念，辨析了常见误区，并通过例题巩固。下一节我们将在此基础上探讨其基本性质。
<!--m ${o2} s=${s('generated')}-->`
}
