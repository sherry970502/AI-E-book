import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * 全站密码门（HTTP Basic Auth）——保护公网部署，挡住随便点进来的人/爬虫，
 * 尤其是护住会消耗 API 额度的 /api/ai/* 接口。
 *
 * 密码来自环境变量 APP_PASSWORD（不写死进代码——仓库是公开的）：
 *   - 未设置 → 不启用门（本地开发 / Mock 演示不受影响）
 *   - 已设置 → 全站需要密码；浏览器弹原生登录框，用户名随便填，密码要对
 *
 * Next 16：middleware 已改名为 proxy（运行时 nodejs，可用 Buffer）。
 */
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD
  if (!password) return NextResponse.next() // 没设密码就不拦

  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8')
      const pass = decoded.slice(decoded.indexOf(':') + 1) // 用户名忽略，只校验密码
      if (pass === password) return NextResponse.next()
    } catch { /* 解析失败 → 落到下面的 401 */ }
  }

  return new NextResponse('需要登录', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="AI Ebooking", charset="UTF-8"' },
  })
}

export const config = {
  // 拦截所有请求，但放行静态资源（否则会把 CSS/JS/图片也挡住）
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
