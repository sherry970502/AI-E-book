import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getDb } from '@/lib/db'

/**
 * 部署诊断：查看数据库到底写在哪、Volume 挂载点能不能持久化。
 * 线上访问 /api/debug/db（需登录）读取运行时真相，排查数据丢失。
 */
export async function GET() {
  const envDbPath = process.env.DB_PATH ?? null
  const resolved = envDbPath || path.join(process.cwd(), 'ai-ebook.db')
  const dir = path.dirname(resolved)

  const info: Record<string, unknown> = {
    'env.DB_PATH': envDbPath,           // 环境变量有没有被读到（null = 没设或没生效 → 会写临时目录）
    resolvedDbPath: resolved,           // 实际使用的库文件路径
    cwd: process.cwd(),
    dir,
  }

  // 库文件当前状态
  try {
    const st = fs.statSync(resolved)
    info.dbFileExists = true
    info.dbFileSizeKB = Math.round(st.size / 1024)
    info.dbFileMtime = st.mtime.toISOString()
  } catch {
    info.dbFileExists = false
  }

  // 目录可写性探针：往库所在目录写一个文件再删，验证 Volume 是否可持久写
  try {
    const probe = path.join(dir, '.write-probe')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(probe, String(Date.now()))
    info.dirWritable = true
    fs.unlinkSync(probe)
  } catch (e) {
    info.dirWritable = false
    info.dirWriteError = e instanceof Error ? e.message : String(e)
  }

  // 目录里现有文件（看 .db / .db-wal 是否落在这里）
  try {
    info.dirContents = fs.readdirSync(dir).filter(f => f.includes('ai-ebook') || f.startsWith('.write'))
  } catch { /* ignore */ }

  // 实际连到库里，报告书的数量（确认这个库文件就是应用在用的那个）
  try {
    const n = (getDb().prepare('SELECT COUNT(*) AS n FROM books').get() as { n: number }).n
    info.bookCount = n
  } catch (e) {
    info.bookCountError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(info, { headers: { 'Cache-Control': 'no-store' } })
}
