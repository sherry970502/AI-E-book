export function buildParseBookSystem() {
  return `你是教育内容结构化专家，把教材文本解析为结构化「课本骨架」。
输出必须是严格合法的 JSON 对象，不要任何多余文字、不要代码块包裹。`
}

export function buildParseBookPrompt(text: string, fileName: string) {
  return `请将以下教材文本（文件名：${fileName}）解析为课本骨架，提取四层信息。

返回 JSON（严格遵守此结构）：
{
  "chapters": [{"title":"第一章 …","proportion":"约30%"}],
  "units": [
    {"chapter_title":"第一章 …","section_title":"1.1 …","core_concept":"核心概念名","definition":"定义或解释","examples":["例题/例子描述"],"difficulty":"easy|medium|hard"}
  ],
  "teaching_design": {
    "sequence": "原书的讲解顺序与递进逻辑（60字内）",
    "exercise_distribution": "例题/练习的分布特点（40字内）",
    "difficulty_curve": "难度梯度描述（40字内）"
  },
  "style": {
    "language": "语言风格（如：学术严谨/通俗对话式）",
    "assumed_audience": "原书隐含的受众假设",
    "layout_features": "排版特征（40字内）"
  },
  "objectives": [
    {"description":"学完本书后学生能……（可测量的行为动词表述）","cognitive_dimension":"remember|understand|apply|analyze|evaluate|create","unit_concepts":["该目标对应的知识单元 core_concept 列表"]}
  ]
}

说明：
- chapters = 结构层（目录树 + 各章篇幅占比）
- units = 知识层（每小节拆成最小教学颗粒，每个单元一个核心概念）
- teaching_design = 教学设计层
- style = 风格层
- objectives = 从原书内容识别出的学习目标（5-12 条，将进入学习目标库供老师管理调整）
- 至少解析出 5 个知识单元；example 保留原书表述特征

原书文本（前 8000 字）：
${text.slice(0, 8000)}`
}
