import type { Book } from '@/types'

/** 封面主视觉：让模型直接输出纯 SVG（无文字），供 CoverPage 渲染。 */
export function buildCoverSystem() {
  return '你是封面设计师与 SVG 工程师，输出完整合法、可直接嵌入 HTML 的 SVG。'
}

export function buildCoverPrompt(book: Book) {
  const styleWord = book.style === 'casual' ? '活泼可爱' : book.style === 'academic' ? '简洁学术' : '现代简约'
  return `为教材《${book.title}》设计一幅封面主视觉插画。主题：${book.topic}；受众：${book.audience_grade}；风格：${styleWord}。要求：纯 SVG（viewBox="0 0 400 300"），抽象几何或主题元素构图，不含文字，配色和谐。只输出 <svg>…</svg>。`
}
