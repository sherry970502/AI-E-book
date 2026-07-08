export async function parseFileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return file.text()
  }

  if (name.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer()
    const pdfjs = await import('pdfjs-dist')
    // worker 文件由 public/pdf.worker.min.mjs 提供（版本须与 pdfjs-dist 一致）。
    // pdfjs v5 的 worker 是 ESM（.mjs），旧路径 /pdf.worker.min.js 不存在会导致解析报错。
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => ('str' in item ? (item as { str: string }).str : '')).join(' '))
    }
    return pages.join('\n\n')
  }

  if (name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer()
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const arrayBuffer = await file.arrayBuffer()
    const XLSX = await import('xlsx')
    const wb = XLSX.read(arrayBuffer, { type: 'array' })
    const lines: string[] = []
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      lines.push(`=== ${sheetName} ===`)
      lines.push(XLSX.utils.sheet_to_csv(ws))
    }
    return lines.join('\n')
  }

  throw new Error(`不支持的文件格式：${name}`)
}
