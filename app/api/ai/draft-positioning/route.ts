import { NextRequest, NextResponse } from 'next/server'
import { callClaude, parseJSON } from '@/lib/ai'
import { buildPositioningSystem, buildPositioningPrompt } from '@/lib/prompts/draft'

export interface PositioningPlan {
  title: string
  topic: string
  positioning: string
  audience_grade: string
  audience_age: string
  prior_level: string
  reference_note: string
  modules: { name: string; desc: string }[]
}

/** Mock：无 API key 时按需求文本拼一份通用方案，保证向导全流程可走通 */
function mockPlan(need: string): PositioningPlan {
  const kw = need.replace(/给|做|一本|课本|教材|的|用/g, '').slice(0, 8) || '通识'
  return {
    title: `${kw}导论`,
    topic: kw,
    positioning: `（Mock）面向初学者的${kw}入门教材：以真实情境切入建立直觉，再过渡到系统概念，解决传统教材「上来就抽象」导致的入门劝退问题。`,
    audience_grade: /大学/.test(need) ? '大学' : /高中/.test(need) ? '高中' : /初中/.test(need) ? '初中' : /小学/.test(need) ? '小学' : '大学',
    audience_age: '18-22岁',
    prior_level: '有高中基础',
    reference_note: '（Mock）参照该学科主流入门教材通行框架',
    modules: [
      { name: '概念基础', desc: '学科的核心概念、术语体系与基本框架' },
      { name: '核心原理', desc: '支撑全学科的关键原理与经典模型' },
      { name: '方法与实践', desc: '典型方法论、分析工具与动手实践' },
      { name: '综合应用', desc: '真实世界的应用场景与案例分析' },
      { name: '前沿与拓展', desc: '学科前沿方向与后续学习路径' },
    ],
  }
}

export async function POST(req: NextRequest) {
  const { need } = await req.json()
  if (!need?.trim()) return NextResponse.json({ error: '请先描述你的需求' }, { status: 400 })

  let plan: PositioningPlan
  if (!process.env.ANTHROPIC_API_KEY) {
    plan = mockPlan(need)
  } else {
    const raw = await callClaude(
      [{ role: 'user', content: buildPositioningPrompt(need.trim()) }],
      buildPositioningSystem(),
      3000
    )
    plan = parseJSON<PositioningPlan>(raw, mockPlan(need))
  }
  // 守护：模块至少 3 个，缺字段兜底
  if (!Array.isArray(plan.modules) || plan.modules.length < 3) plan.modules = mockPlan(need).modules
  return NextResponse.json(plan)
}
