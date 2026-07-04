'use client'
import { useState, useRef } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { parseFileToText } from '@/lib/file-parser'

export interface ParseMeta {
  chapters: { title: string; proportion?: string }[]
  teaching_design: { sequence: string; exercise_distribution: string; difficulty_curve: string }
  style: { language: string; assumed_audience: string; layout_features: string }
}

interface Props {
  bookId: string
  onParsed: (skeletonId: string, unitCount: number, meta: ParseMeta | null, extractedObjectiveIds: string[]) => void
}

// 四层解析的阶段性进度提示（需求 4.1：解析过程展示进度）
const PARSE_STAGES = [
  '① 结构层：识别目录树与章节层级…',
  '② 知识层：拆解知识单元（概念/定义/例题）…',
  '③ 教学设计层：分析讲解顺序与难度梯度…',
  '④ 风格层：识别语言风格与受众假设…',
]

export function ImportUploader({ bookId, onParsed }: Props) {
  const [status, setStatus] = useState<'idle' | 'reading' | 'parsing' | 'done' | 'error'>('idle')
  const [fileName, setFileName] = useState('')
  const [message, setMessage] = useState('')
  const [stage, setStage] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    setStatus('reading')
    try {
      const text = await parseFileToText(file)
      setStatus('parsing')
      setMessage(`已提取 ${text.length.toLocaleString()} 字`)
      const stageTimer = setInterval(() => setStage(s => Math.min(s + 1, PARSE_STAGES.length - 1)), 1600)
      const res = await fetch('/api/ai/parse-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, text, fileName: file.name }),
      })
      clearInterval(stageTimer)
      if (!res.ok) throw new Error(await res.text())
      const { skeletonId, unitCount, meta, extractedObjectiveIds, extractedCount } = await res.json()
      setStatus('done')
      setMessage(`解析完成！${unitCount} 个知识单元，识别出 ${extractedCount ?? 0} 条学习目标（已入库）`)
      onParsed(skeletonId, unitCount, meta ?? null, extractedObjectiveIds ?? [])
    } catch (e: unknown) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : '解析失败')
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div
        className="w-full max-w-lg border-2 border-dashed border-zinc-300 rounded-xl p-10 flex flex-col items-center gap-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <input ref={inputRef} type="file" className="hidden" accept=".txt,.md,.pdf,.docx,.xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        {status === 'idle' && (
          <>
            <Upload className="w-10 h-10 text-zinc-400" />
            <div className="text-center">
              <p className="font-medium text-zinc-700">上传原书文件</p>
              <p className="text-sm text-zinc-500 mt-1">支持 TXT / PDF / DOCX / XLSX / MD</p>
            </div>
          </>
        )}
        {(status === 'reading' || status === 'parsing') && (
          <div className="flex flex-col items-center gap-3 w-full">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-zinc-600">{fileName} <span className="text-zinc-400">{message}</span></p>
            {status === 'parsing' && (
              <div className="w-full max-w-xs space-y-1.5 mt-1">
                {PARSE_STAGES.map((s, i) => (
                  <p key={i} className={`text-[11.5px] transition-colors ${i < stage ? 'text-green-600' : i === stage ? 'text-blue-600 animate-pulse' : 'text-zinc-300'}`}>
                    {i < stage ? '✓ ' : ''}{s}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        {status === 'done' && (
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 text-green-500" />
            <p className="text-sm font-medium text-green-700">{message}</p>
            <p className="text-xs text-zinc-500">{fileName}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-red-600">{message}</p>
            <button className="text-xs text-zinc-500 underline" onClick={e => { e.stopPropagation(); setStatus('idle'); setMessage('') }}>重试</button>
          </div>
        )}
      </div>
    </div>
  )
}
