/**
 * 从零起草向导的两个 AI 环节（线路 A 头部扩展）：
 *   ① 一句话需求 → 定位方案卡（书名/主题/受众/覆盖模块，对标主流教材惯例）
 *   ② 确认的范围 → 按模块生成学习目标（目标先于大纲——体裁不变量，锚的来源）
 * 输出必须是严格 JSON（parseJSON 解析，字符串内禁未转义英文双引号）。
 */

export function buildPositioningSystem() {
  return `你是资深教材策划编辑，擅长把一句模糊的需求变成一份清晰的课本定位方案。
你熟悉各学段主流教材的覆盖惯例与课程标准，方案要向这些惯例对标，而不是凭空发挥。
只输出一个 JSON 对象，不要任何多余文字、不要代码块包裹。
JSON 字符串值内禁止未转义的英文双引号，引用书名一律用《》。`
}

export function buildPositioningPrompt(need: string) {
  return `用户的原始需求（可能非常简略）：
"""${need}"""

请起草一份课本定位方案，返回 JSON（严格遵守此结构）：
{
  "title": "建议的课本名称（吸引人且准确）",
  "topic": "核心主题（10字内的学科定位）",
  "positioning": "这本书解决什么教学问题、与市面教材的差异（60-100字）",
  "audience_grade": "小学|初中|高中|大学|成人/职业 之一",
  "audience_age": "年龄段（如 18-22岁）",
  "prior_level": "先验水平假设（如 有高中生物基础）",
  "reference_note": "对标依据：参照了哪些主流教材/课程标准的覆盖惯例（40字内，如 参照《普通生物学》通行框架）",
  "modules": [
    {"name": "模块名（6-10字）", "desc": "该模块覆盖什么（20-40字）"}
  ]
}

要求：
- modules 是「内容覆盖范围」的粗颗粒划分（5-8 个），不是章节目录——章节组织是后面的事
- 模块划分要对标该学科主流教材的通行结构，让内行一看就觉得「覆盖是完整的」
- 若用户需求里已指明受众/主题，尊重用户，不要改写`
}

export function buildDraftObjectivesSystem() {
  return `你是课程设计专家，深谙布鲁姆认知目标分类学。
你为课本撰写「学习目标」：以可测量的行为动词开头（能陈述/能区分/能运用/能分析/能评价/能设计……），
一条目标只测一件事，避免「了解」「掌握」这类不可测量的模糊词。
只输出一个 JSON 数组，不要任何多余文字、不要代码块包裹。
JSON 字符串值内禁止未转义的英文双引号。`
}

export function buildDraftObjectivesPrompt(
  topic: string,
  audience: { grade: string; age: string; prior: string },
  modules: { name: string; desc: string }[]
) {
  return `课本主题：${topic}
受众：${audience.grade} / ${audience.age} / 先验水平：${audience.prior}

已确认的覆盖模块（学习目标必须完整覆盖每个模块，不得遗漏，也不得超纲）：
${modules.map((m, i) => `${i + 1}. ${m.name}——${m.desc}`).join('\n')}

请为每个模块生成学习目标，返回 JSON 数组（严格遵守此结构）：
[
  {
    "module": "模块名（与上面完全一致）",
    "objectives": [
      {"description": "能……（可测量的行为动词表述，25-50字）", "cognitive_dimension": "remember|understand|apply|analyze|evaluate|create"}
    ]
  }
]

要求：
- 每个模块 4-7 条目标，全书总量控制在 25-45 条
- 认知维度要有梯度分布：基础模块以 remember/understand 为主，进阶模块含 apply/analyze，至少 2-3 条 evaluate/create
- 目标之间不重复、不互相包含`
}
