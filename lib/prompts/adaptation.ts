/**
 * 二创·自由意图解析：把老师的一段自然语言改编意图 → 3-6 条结构化改编指令。
 * 用于线路 B 改编设置的「自由意图 → 结构化指令回显」。
 */
export function buildIntentParseSystem() {
  return '你是教材改编策划，把老师的自然语言意图转成清晰的结构化改编指令。'
}

export function buildIntentParsePrompt(freeIntent: string) {
  return `老师对改编这本教材的自由意图描述：\n"""${freeIntent}"""\n\n请解析为 3-6 条结构化改编指令（每条一句话，说明改什么、怎么改、影响范围）。只输出 JSON 数组：["指令1","指令2",...]`
}
