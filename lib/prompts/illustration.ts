export function buildIllustrationSystem() {
  return `你是专业的教育插图设计师和SVG工程师。
你的任务是根据段落内容生成一个高质量的SVG教学插图。
SVG必须是完整合法的，能够直接嵌入HTML。`
}

export function buildIllustrationPrompt(
  paragraphText: string,
  sectionTitle: string,
  figureNumber: string
) {
  return `根据以下段落内容，生成一个教学用途的SVG矢量插图：

小节：${sectionTitle}
段落内容：${paragraphText.slice(0, 500)}
图注编号：${figureNumber}

要求：
- SVG 尺寸 600×400
- 风格：简洁的教育风格，黑白为主配合蓝色点缀
- 内容：可视化段落中的核心概念或流程
- 包含清晰的文字标注（中文）
- 在 SVG 底部居中写图注：${figureNumber}

直接输出完整的 SVG 代码，从 <svg 开始，以 </svg> 结束。`
}
