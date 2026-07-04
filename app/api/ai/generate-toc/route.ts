import { NextRequest } from 'next/server'
import { streamClaude } from '@/lib/ai'
import { buildTocSystem, buildTocPrompt } from '@/lib/prompts/toc'
import { getBook, createChapter, createSection, getChapters } from '@/lib/db/queries/books'
import { getObjectivesByIds } from '@/lib/db/queries/objectives'
import { getSkeleton, getKnowledgeUnits } from '@/lib/db/queries/skeletons'
import { getAdaptationPlan } from '@/lib/db/queries/adaptation'
import { randomUUID } from 'crypto'
import type { LearningObjective, KnowledgeUnit } from '@/types'

/**
 * 流式目录生成：NDJSON 输出。
 * 每行 {"type":"chapter","chapter":{...含 sections}}，末行 {"type":"done"}。
 * 每收到一章立即持久化并推送前端，满足「≤15s 看到完整目录（流式）」。
 */

interface RawChapter {
  title: string
  summary?: string
  objective_idx?: number[]
  sections?: { title: string; brief?: string; objective_idx?: number[] }[]
}

export async function POST(req: NextRequest) {
  const { bookId, objectiveIds } = await req.json()
  const book = getBook(bookId)
  if (!book) return new Response('book not found', { status: 404 })

  const objectives = getObjectivesByIds(objectiveIds || [])
  const startIndex = getChapters(bookId).length  // 支持在已有章节后追加

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let chapterCount = 0
      let sectionCount = 0

      const idxToIds = (idx?: number[]) =>
        (idx ?? []).map(i => objectives[i - 1]?.id).filter(Boolean) as string[]

      function persistAndEmit(raw: RawChapter, orderIndex: number) {
        const chapter = createChapter({
          id: randomUUID(),
          book_id: bookId,
          order_index: orderIndex,
          title: raw.title,
          summary: raw.summary ?? null,
          objective_ids: idxToIds(raw.objective_idx),
          status: 'pending',
        })
        const sections = (raw.sections ?? []).map((s, si) =>
          createSection({
            id: randomUUID(),
            chapter_id: chapter.id,
            book_id: bookId,
            order_index: si,
            title: s.title,
            content: null,
            status: 'pending',
            objective_ids: idxToIds(s.objective_idx),
            page_number: null,
            brief: s.brief ?? '',
          })
        )
        chapterCount++
        sectionCount += sections.length
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'chapter', chapter: { ...chapter, sections } }) + '\n'))
      }

      // 改编书：目录基于存活的知识单元（删除标记的单元不进入新书）
      const skeleton = book.source === 'adaptation' ? getSkeleton(bookId) : null
      const aliveUnits = skeleton
        ? getKnowledgeUnits(skeleton.id).filter(u => u.intent !== 'delete')
        : []
      const plan = book.source === 'adaptation' ? getAdaptationPlan(bookId) : null

      try {
        if (!process.env.ANTHROPIC_API_KEY) {
          const mock = skeleton
            ? buildMockAdaptationToc(aliveUnits, objectives)
            : buildMockToc(book.topic, objectives)
          for (let i = 0; i < mock.length; i++) {
            await new Promise(r => setTimeout(r, 500))
            persistAndEmit(mock[i], startIndex + i)
          }
        } else {
          const adaptationCtx = skeleton
            ? `\n\n【改编骨架】新目录必须基于以下知识单元组织（已剔除老师标记删除的内容），并落实改编方案：
${aliveUnits.map(u => `- [${u.intent === 'keep' ? '保留改写' : '深度重写'}] ${u.chapter_title} / ${u.core_concept}`).join('\n')}
改编方案：受众迁移=${plan?.audience_note || '无'}；教学法=${plan?.pedagogy || '无'}；意图=${[plan?.free_intent, ...(plan?.structured_intent ?? [])].filter(Boolean).join('；') || '无'}`
            : ''
          let buffer = ''
          let emitted = 0
          await streamClaude(
            [{ role: 'user', content: buildTocPrompt(book, objectives) + adaptationCtx }],
            buildTocSystem(),
            (chunk) => {
              buffer += chunk
              // 按行切分，完整行立即解析入库并推送
              let nl: number
              while ((nl = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, nl).trim()
                buffer = buffer.slice(nl + 1)
                if (!line) continue
                try {
                  const raw = JSON.parse(line) as RawChapter
                  if (raw.title) persistAndEmit(raw, startIndex + emitted++)
                } catch { /* 半截行或噪音，跳过 */ }
              }
            },
            8000
          )
          // 收尾：缓冲区里可能还有最后一行
          const last = buffer.trim()
          if (last) {
            try {
              const raw = JSON.parse(last) as RawChapter
              if (raw.title) persistAndEmit(raw, startIndex + emitted++)
            } catch { /* noop */ }
          }
        }
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', chapterCount, sectionCount }) + '\n'))
      } catch (err) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : '生成失败' }) + '\n'))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' },
  })
}

/** 改编 Mock：按原书章组织，剔除删除单元，节名取知识单元 */
function buildMockAdaptationToc(units: KnowledgeUnit[], objectives: LearningObjective[]): RawChapter[] {
  const byChapter = new Map<string, KnowledgeUnit[]>()
  for (const u of units) {
    if (!byChapter.has(u.chapter_title)) byChapter.set(u.chapter_title, [])
    byChapter.get(u.chapter_title)!.push(u)
  }
  let ci = 0
  return [...byChapter.entries()].map(([chTitle, chUnits]) => {
    ci++
    return {
      title: `第${['一', '二', '三', '四', '五', '六', '七', '八'][ci - 1] ?? ci}章 ${chTitle.replace(/^第[一二三四五六七八九十\d]+章\s*/, '')}（改编版）`,
      summary: `基于原书改编：${chUnits.map(u => u.core_concept).slice(0, 3).join('、')}`,
      objective_idx: objectives.length ? [((ci - 1) * 2) % objectives.length + 1, ((ci - 1) * 2 + 1) % objectives.length + 1] : [],
      sections: chUnits.map((u, si) => ({
        title: `${ci}.${si + 1} ${u.section_title || u.core_concept}`,
        brief: `围绕「${u.core_concept}」展开：${u.definition?.slice(0, 40) ?? '按新受众重新组织讲解'}${u.examples.length ? `；配例：${u.examples[0]}` : ''}`,
        objective_idx: objectives.length ? [(si % objectives.length) + 1] : [],
      })),
    }
  })
}

function buildMockToc(topic: string, objectives: LearningObjective[]): RawChapter[] {
  const pick = (...idx: number[]) => idx.filter(i => i <= objectives.length)
  return [
    {
      title: `第一章 ${topic}：概念导入`, summary: '从生活情境切入建立直觉认知，再过渡到严格定义，辨析常见误区，为全书打下概念地基', objective_idx: pick(1, 2),
      sections: [
        { title: '1.1 从生活现象说起', brief: '用 2-3 个真实情境（售货机、一卡通）引出"对应关系"的直觉，不出现形式化定义', objective_idx: pick(1) },
        { title: '1.2 核心概念的定义', brief: '从直觉抽象出严格定义，强调确定性与唯一性两个要件，配对应关系示意图', objective_idx: pick(2) },
        { title: '1.3 概念辨析与常见误区', brief: '辨析"对应≠相等"等 3 个典型误区，每个误区配一个反例', objective_idx: pick(2) },
      ],
    },
    {
      title: '第二章 基本性质与方法', summary: '在概念地基上推导基本性质，训练两类核心分析方法，难度平缓上升', objective_idx: pick(3, 4),
      sections: [
        { title: '2.1 基本性质', brief: '推导三条基本性质，每条给出证明思路与几何直观', objective_idx: pick(3) },
        { title: '2.2 分析方法一', brief: '讲授代数分析法：步骤拆解 + 两道递进例题', objective_idx: pick(3, 4) },
        { title: '2.3 分析方法二', brief: '讲授图像分析法，与方法一对比适用场景', objective_idx: pick(4) },
      ],
    },
    {
      title: '第三章 典型问题深入', summary: '以典型例题为骨架训练解题模式，从模仿到变式迁移', objective_idx: pick(5, 6),
      sections: [
        { title: '3.1 典型例题精讲', brief: '精讲 3 道典型题：审题→建模→求解→回顾四步法', objective_idx: pick(5) },
        { title: '3.2 变式训练', brief: '对每道典型题做 2 个变式，训练条件变化下的迁移能力', objective_idx: pick(6) },
      ],
    },
    {
      title: '第四章 综合应用与拓展', summary: '回到真实世界：综合运用 + 学科前沿一瞥，收束全书', objective_idx: pick(7, 8),
      sections: [
        { title: '4.1 综合应用案例', brief: '一个完整的真实建模案例，串联前三章全部方法', objective_idx: pick(7) },
        { title: '4.2 拓展视野', brief: '与后续课程的衔接 + 一篇科普式前沿阅读', objective_idx: pick(8) },
      ],
    },
  ]
}
