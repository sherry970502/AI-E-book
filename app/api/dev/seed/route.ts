import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/index'

export function POST() {
  const db = getDb()

  db.exec(`DELETE FROM chat_nodes; DELETE FROM questions; DELETE FROM paragraphs; DELETE FROM sections; DELETE FROM chapters; DELETE FROM knowledge_units; DELETE FROM skeletons; DELETE FROM books;`)

  // Book
  db.prepare(`INSERT INTO books (id,title,topic,positioning,audience_grade,audience_age,prior_level,style,orientation,target_word_count,target_page_count,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    'book-001', '高中数学：函数与极限', '高中数学', '侧重概念直觉培养，弥补传统教材抽象性不足', '高一下学期', '16-17岁', '已学过初中代数', 'mixed', 'portrait', 25000, 72, 'adaptation'
  )

  // Chapters
  const chapters = [
    { id: 'ch-01', title: '第一章 函数的概念与表示', summary: '从映射出发理解函数本质，掌握三种表示方法' },
    { id: 'ch-02', title: '第二章 基本初等函数', summary: '幂函数、指数函数、对数函数的图像与性质' },
    { id: 'ch-03', title: '第三章 函数的应用', summary: '利用函数模型解决实际问题，导数初步' },
  ]
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i]
    db.prepare(`INSERT INTO chapters (id,book_id,order_index,title,summary,objective_ids,status) VALUES (?,?,?,?,?,?,?)`).run(c.id, 'book-001', i, c.title, c.summary, '[]', 'pending')
  }

  // Sections with content
  const sections = [
    {
      id: 'sec-01', chapter_id: 'ch-01', order_index: 0, title: '1.1 函数的概念',
      content: `## 什么是函数？

在初中，我们已经接触了函数的朴素定义：两个变量 $x$ 和 $y$，如果对每一个 $x$ 值，$y$ 都有**唯一确定的值**与之对应，那么就说 $y$ 是 $x$ 的函数。

但这个定义不够严格，高中阶段我们引入**映射**的概念来重新理解函数。

### 映射的本质

**映射**是指从集合 A 到集合 B 的一种对应规则，使得 A 中的**每一个元素**在 B 中都有**唯一**的对应元素。

> 关键词：每一个 → 完备性；唯一 → 确定性

**函数**就是从数集到数集的映射。

$$f: A \\to B, \\quad x \\mapsto f(x)$$

### 三要素

函数由三个要素确定：

| 要素 | 说明 | 例子 |
|------|------|------|
| **定义域** | 自变量 $x$ 的取值范围 | $x \\in [0, +\\infty)$ |
| **值域** | 因变量 $y$ 的所有可能取值 | $y \\in [0, +\\infty)$ |
| **对应法则** | $x$ 如何确定 $y$ | $y = \\sqrt{x}$ |

两个函数相同，当且仅当定义域和对应法则完全相同（值域自然一致）。

### 小结

函数的核心是"确定性"——给定自变量，因变量唯一确定。这是函数区别于一般关系的本质特征。`,
      status: 'completed',
    },
    {
      id: 'sec-02', chapter_id: 'ch-01', order_index: 1, title: '1.2 函数的三种表示方法',
      content: `## 三种表示方法

函数可以用三种方式来描述，各有优劣，实际问题中往往需要灵活转换。

### 1. 解析法（公式法）

用数学表达式直接给出对应法则：

$$y = 2x + 1, \\quad x \\in \\mathbb{R}$$

**优点**：精确，便于计算和推导
**适用**：有明确数学规律的函数

### 2. 列表法（表格法）

通过列出若干 $(x, y)$ 对应值的表格来描述函数。

| $x$ | 1 | 2 | 3 | 4 | 5 |
|-----|---|---|---|---|---|
| $y$ | 1 | 4 | 9 | 16 | 25 |

**优点**：直观，数据来源于测量时必须用此法
**适用**：离散数据，如物理实验数据

### 3. 图象法

在坐标系中用曲线或折线表示函数。

[图1.2：$y = x^2$ 的抛物线图像，顶点在原点，开口向上]

**优点**：可视化强，能直观看出单调性、极值等
**适用**：需要展示整体变化趋势

### 方法互换

三种方法可以相互转化：
- 已知解析式 → 列表或画图
- 已知表格 → 尝试寻找规律写解析式
- 已知图象 → 读出关键点写解析式（分段函数）`,
      status: 'completed',
    },
    {
      id: 'sec-03', chapter_id: 'ch-02', order_index: 0, title: '2.1 指数函数',
      content: `## 指数函数

**指数函数**的一般形式为：

$$y = a^x \\quad (a > 0, a \\neq 1)$$

其中 $a$ 称为**底数**，$x$ 是自变量，定义域为 $\\mathbb{R}$。

### 为什么要求 $a > 0$ 且 $a \\neq 1$？

- 若 $a \\leq 0$，当 $x = \\frac{1}{2}$ 时 $a^x = \\sqrt{a}$ 无意义（实数范围内）
- 若 $a = 1$，则 $y = 1^x = 1$，退化为常数函数，失去"指数"的意义

### 图像与性质

[图2.1：$y = 2^x$（增函数）与 $y = (\\frac{1}{2})^x$（减函数）的对比图]

| 性质 | $a > 1$ | $0 < a < 1$ |
|------|---------|-------------|
| 单调性 | 单调递增 | 单调递减 |
| 过定点 | $(0, 1)$ | $(0, 1)$ |
| 图像位置 | 始终在 $x$ 轴上方 | 始终在 $x$ 轴上方 |

### 自然指数函数

当底数取自然常数 $e \\approx 2.718$ 时，得到**自然指数函数** $y = e^x$，在微积分中具有特殊重要性：

$$\\frac{d}{dx} e^x = e^x$$

这是数学中极少数"求导不变"的函数。`,
      status: 'completed',
    },
    {
      id: 'sec-04', chapter_id: 'ch-02', order_index: 1, title: '2.2 对数函数',
      content: `## 对数函数

**对数函数**是指数函数的反函数：

$$y = \\log_a x \\quad (a > 0, a \\neq 1, x > 0)$$

### 对数的本质

"$\\log_a x = y$" 的含义是"$a$ 的几次方等于 $x$"，即：

$$\\log_a x = y \\iff a^y = x$$

**例**：$\\log_2 8 = 3$，因为 $2^3 = 8$

### 图像

[图2.2：$y = \\log_2 x$（增函数）与 $y = \\log_{0.5} x$（减函数）关于 $y$ 轴右侧的图像]

对数函数与对应指数函数的图像**关于直线 $y = x$ 对称**（互为反函数的几何意义）。

### 常用对数法则

$$\\log_a(MN) = \\log_a M + \\log_a N$$
$$\\log_a \\frac{M}{N} = \\log_a M - \\log_a N$$
$$\\log_a M^n = n \\log_a M$$

### 换底公式

$$\\log_a b = \\frac{\\log_c b}{\\log_c a}$$

计算器通常只有 $\\lg$（以10为底）和 $\\ln$（以 $e$ 为底），换底公式让我们可以计算任意底的对数。`,
      status: 'completed',
    },
    {
      id: 'sec-05', chapter_id: 'ch-03', order_index: 0, title: '3.1 导数的直观理解',
      content: `## 导数：变化率的语言

**导数**回答的问题是：函数在某一点的变化有多"快"？

### 从平均速度到瞬时速度

设物体位置函数为 $s(t)$，从 $t_0$ 到 $t_0 + \\Delta t$ 的**平均速度**：

$$\\bar{v} = \\frac{\\Delta s}{\\Delta t} = \\frac{s(t_0 + \\Delta t) - s(t_0)}{\\Delta t}$$

当 $\\Delta t \\to 0$ 时，平均速度的极限就是 $t_0$ 时刻的**瞬时速度**，这正是导数的定义：

$$f'(x_0) = \\lim_{\\Delta x \\to 0} \\frac{f(x_0 + \\Delta x) - f(x_0)}{\\Delta x}$$

### 几何意义

[图3.1：割线趋近切线的动态示意图]

导数 $f'(x_0)$ 等于曲线 $y = f(x)$ 在点 $(x_0, f(x_0))$ 处**切线的斜率**。

### 基本求导法则

| 函数 | 导数 |
|------|------|
| $y = c$（常数） | $y' = 0$ |
| $y = x^n$ | $y' = nx^{n-1}$ |
| $y = e^x$ | $y' = e^x$ |
| $y = \\ln x$ | $y' = \\frac{1}{x}$ |

$$[f(x) + g(x)]' = f'(x) + g'(x)$$
$$[f(x) \\cdot g(x)]' = f'(x)g(x) + f(x)g'(x)$$

**例**：$f(x) = x^3 - 2x + 5$，则 $f'(x) = 3x^2 - 2$`,
      status: 'completed',
    },
    {
      id: 'sec-06', chapter_id: 'ch-03', order_index: 1, title: '3.2 函数的单调性与极值',
      content: null,
      status: 'pending',
    },
  ]

  for (const s of sections) {
    db.prepare(`INSERT INTO sections (id,chapter_id,book_id,order_index,title,content,status,objective_ids,page_number) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      s.id, s.chapter_id, 'book-001', s.order_index, s.title, s.content ?? null, s.status, '["math-001","math-002"]', null
    )
  }

  // Mock questions for sec-01
  const questions = [
    {
      id: 'q-001', section_id: 'sec-01',
      stem: '下列说法中，正确的是？',
      options: JSON.stringify([
        { label: 'A', text: '函数的定义域可以是空集', is_correct: false },
        { label: 'B', text: '两个函数的对应法则相同，则这两个函数相同', is_correct: false },
        { label: 'C', text: '函数的定义域和对应法则确定后，值域也随之确定', is_correct: true },
        { label: 'D', text: '映射和函数是完全相同的概念', is_correct: false },
      ]),
      explanation: '函数由定义域和对应法则唯一确定，值域是由二者共同决定的结果集，不是第三个独立要素。选项B错误因为还需要定义域相同。',
      objective_ids: '["math-001"]',
    },
    {
      id: 'q-002', section_id: 'sec-01',
      stem: '已知 $f(x) = x^2 + 1$，$g(x) = x^2 + 1\\ (x \\geq 0)$，则 $f$ 与 $g$：',
      options: JSON.stringify([
        { label: 'A', text: '是同一个函数', is_correct: false },
        { label: 'B', text: '不是同一个函数，因为对应法则不同', is_correct: false },
        { label: 'C', text: '不是同一个函数，因为定义域不同', is_correct: true },
        { label: 'D', text: '不是同一个函数，因为值域不同', is_correct: false },
      ]),
      explanation: '$f$ 的定义域是 $\\mathbb{R}$，$g$ 的定义域是 $[0,+\\infty)$，虽然对应法则相同，但定义域不同，所以是不同的函数。',
      objective_ids: '["math-001"]',
    },
  ]
  for (const q of questions) {
    db.prepare(`INSERT INTO questions (id,section_id,stem,options,explanation,objective_ids) VALUES (?,?,?,?,?,?)`).run(q.id, q.section_id, q.stem, q.options, q.explanation, q.objective_ids)
  }

  // Mock skeleton & knowledge units
  db.prepare(`INSERT INTO skeletons (id,book_id,original_file_name,toc_json) VALUES (?,?,?,?)`).run(
    'skel-001', 'book-001', '人教版数学必修一.pdf',
    JSON.stringify({ chapters: ['函数', '基本初等函数', '函数应用'] })
  )
  const units = [
    { id: 'ku-01', chapter_title: '函数', section_title: '函数的概念', core_concept: '映射与函数', definition: '从非空数集A到数集B的映射称为函数', difficulty: 'medium', intent: 'rewrite' },
    { id: 'ku-02', chapter_title: '函数', section_title: '函数的表示', core_concept: '三种表示方法', definition: '解析法、列表法、图象法', difficulty: 'easy', intent: 'keep' },
    { id: 'ku-03', chapter_title: '基本初等函数', section_title: '指数函数', core_concept: '指数函数定义', definition: 'y=a^x (a>0,a≠1)', difficulty: 'medium', intent: 'rewrite' },
    { id: 'ku-04', chapter_title: '基本初等函数', section_title: '对数函数', core_concept: '对数运算法则', definition: '积的对数等于对数的和', difficulty: 'hard', intent: 'expand' },
    { id: 'ku-05', chapter_title: '函数应用', section_title: '导数', core_concept: '导数定义', definition: '瞬时变化率，切线斜率', difficulty: 'hard', intent: 'rewrite' },
  ]
  for (const u of units) {
    db.prepare(`INSERT INTO knowledge_units (id,skeleton_id,chapter_title,section_title,core_concept,definition,examples,difficulty,intent,objective_ids) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      u.id, 'skel-001', u.chapter_title, u.section_title, u.core_concept, u.definition, '[]', u.difficulty, u.intent, '[]'
    )
  }

  return NextResponse.json({ ok: true, message: '✅ Mock数据已写入：1本书，3章，6节（5节有内容），2道题，5个知识单元' })
}
