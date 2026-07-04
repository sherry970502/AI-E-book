import type { LearningObjective } from '@/types'

export function buildQuestionsSystem() {
  return `你是专业的教育评估专家，擅长根据学习目标设计精准的测试题。
返回严格合法的 JSON，不要有多余文字。`
}

export function buildQuestionsPrompt(
  sectionTitle: string,
  content: string,
  objectives: LearningObjective[],
  count = 4,
  paragraphText?: string
) {
  const objList = objectives.map(o => `[${o.id}] ${o.description}（${o.cognitive_dimension}）`).join('\n')
  const scopeNote = paragraphText
    ? `\n【定向出题】老师选中了下面这段正文，所有题目必须紧扣该段内容：\n"""${paragraphText}"""\n`
    : ''
  return `根据以下小节内容，生成 ${count} 道单选题：

小节：${sectionTitle}

学习目标（每题必须在 objective_ids 中标注考察的目标）：
${objList}
${scopeNote}
正文节选（用于出题参考）：
${content.slice(0, 2000)}

返回 JSON：
{
  "questions": [
    {
      "stem": "题干（考察哪个知识点）",
      "options": [
        { "label": "A", "text": "选项文字", "is_correct": false },
        { "label": "B", "text": "选项文字", "is_correct": true },
        { "label": "C", "text": "选项文字", "is_correct": false },
        { "label": "D", "text": "选项文字", "is_correct": false }
      ],
      "explanation": "解析（引用正文对应知识点，100字内）",
      "objective_ids": ["对应的学习目标id"]
    }
  ]
}`
}
