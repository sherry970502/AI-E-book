import type { Book, Chapter, Section, Paragraph, Illustration } from '@/types'

/**
 * AI 主编节点式对话：每条指令 → 解析为结构化操作 → 服务端执行 → 看板刷新。
 * 模型必须输出严格 JSON（单个对象，不要代码块）。
 */

export function buildChatSystem(book: Book) {
  return `你是《${book.title}》的 AI 主编（Co-Author），能直接执行对课本结构与内容的修改。

收到用户指令后：
1. 判定影响范围 scope：outline（整书大纲）| chapter（某章内部）| section（某节）| paragraph（正文段落）| none（纯咨询，不改动）
2. 生成操作列表 operations（可为空）。可用操作：
   - {"op":"delete_chapter","chapter":章序号}
   - {"op":"add_chapter","title":"第N章 标题","summary":"概述","after":插在第几章之后(0=最前)}
   - {"op":"rename_chapter","chapter":章序号,"title":"新标题"}
   - {"op":"set_summary","chapter":章序号,"summary":"新概述"}
   - {"op":"add_section","chapter":章序号,"title":"N.M 节标题"}
   - {"op":"delete_section","chapter":章序号,"section":节序号}
   - {"op":"rename_section","chapter":章序号,"section":节序号,"title":"新标题"}
   - {"op":"set_elements","chapter":章序号或省略(全书),"section":节序号或省略(整章),"exercise":true/false,"illustration":true/false}
     功能元素配置：exercise=互动练习，illustration=自动配图。例：「给第二章每节都加练习」→ {"op":"set_elements","chapter":2,"exercise":true}
   - {"op":"set_brief","chapter":章序号,"section":节序号,"brief":"新的教学要点（30-60字，具体写清讲什么怎么讲）"}
     注：set_summary 改的是章级教学大纲，set_brief 改的是节级教学要点。
   章序号/节序号均为当前目录中的 1-based 序号。

   正文段落操作（仅当消息里提供了「当前正文」时可用，段序号即其中标注的 1-based 序号）：
   - {"op":"edit_paragraph","paragraph":段序号,"content":"改写后的完整段落文本"}
     用户要求改某段的措辞/引用/说法时用这个。content 必须是该段的完整替换文本：
     按用户要求改动之处，未提及的部分原样保留，不要顺手润色。
   - {"op":"insert_paragraph","after":插在第几段之后(0=节首),"content":"新段落完整文本"}
   - {"op":"delete_paragraph","paragraph":段序号}
     整段删除。若用户只是要删掉段内某句话，用 edit_paragraph 给出删除该句后的全文。
   - {"op":"delete_illustration","figure":插图序号}
     删除本节某张插图，序号即「当前正文」里插图清单标注的 1-based 序号。
3. reply 用一两句话向用户说明你做了什么（或为什么不需要改动）。

注意：
- 「缩减为最核心的N章」= 保留最核心的N章、删除其余（可配合 rename 让保留章节标题连贯）
- 新增章/节的标题要与现有编号风格一致
- 删除操作按序号从大到小排列（避免序号漂移）
- 用户引用了选区内容时，先在「当前正文」里定位它属于第几段，再下段落操作
- 用户想改正文但当前没有「当前正文」上下文时，不要下段落操作；在 reply 里请用户先翻到要改的那一页再说一遍
- JSON 字符串值内不要出现未转义的英文双引号，中文引用一律用「」或《》

只输出一个 JSON 对象：
{"scope":"outline|chapter|section|paragraph|none","reply":"...","operations":[...]}`
}

export function buildChatPrompt(
  instruction: string,
  chapters: (Chapter & { sections?: Section[] })[],
  sectionsByChapter: Record<string, Section[]>,
  context?: string,
  currentSection?: { title: string; paragraphs: Paragraph[]; illustrations?: Illustration[] } | null
) {
  const tocStr = chapters.map((c, i) => {
    const secs = (sectionsByChapter[c.id] ?? []).map((s, j) =>
      `    ${i + 1}.${j + 1} ${s.title}（${s.status}）${s.brief ? ` 要点：${s.brief}` : ''}`).join('\n')
    return `第${i + 1}章 ${c.title}${c.summary ? ` —— 教学大纲：${c.summary}` : ''}\n${secs}`
  }).join('\n')

  // 用户当前翻到的正文页：逐段编号给出全文，主编才能执行段落级修改
  const paraIdx = new Map(currentSection?.paragraphs.map((p, i) => [p.id, i + 1]) ?? [])
  const illusStr = currentSection?.illustrations?.length
    ? `本节插图清单：\n` + currentSection.illustrations.map((il, i) =>
        `【插图${i + 1}】${il.figure_number}「${il.caption}」${il.paragraph_id && paraIdx.has(il.paragraph_id) ? `（挂在第${paraIdx.get(il.paragraph_id)}段之后）` : ''}`).join('\n') + '\n'
    : ''
  const bodyStr = currentSection?.paragraphs.length
    ? `\n当前正文（用户正在看的「${currentSection.title}」，共 ${currentSection.paragraphs.length} 段）：\n` +
      currentSection.paragraphs.map((p, i) => `【第${i + 1}段】${p.content}`).join('\n') + '\n' + illusStr
    : ''

  return `当前目录（含状态）：
${tocStr}
${bodyStr}
${context ? `用户引用的选区内容：\n"""${context}"""\n\n` : ''}用户指令：${instruction}`
}
