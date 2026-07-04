import type { LearningObjective } from '@/types'

export const OBJECTIVES_SEED: LearningObjective[] = [
  // ─── 数学 ─────────────────────────────────────────────────────────────────
  { id: 'math-001', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '理解函数的概念及函数的三种表示方法', cognitive_dimension: 'understand', tags: ['函数', '代数'] },
  { id: 'math-002', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '掌握一次函数、二次函数的图像与性质', cognitive_dimension: 'apply', tags: ['函数', '图像'] },
  { id: 'math-003', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '能对复杂函数进行定义域与值域分析', cognitive_dimension: 'analyze', tags: ['函数', '定义域'] },
  { id: 'math-004', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '理解导数的几何意义与物理意义', cognitive_dimension: 'understand', tags: ['导数', '微积分'] },
  { id: 'math-005', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '掌握基本求导法则并能对多项式函数求导', cognitive_dimension: 'apply', tags: ['导数', '运算'] },
  { id: 'math-006', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '能利用导数判断函数单调性与极值', cognitive_dimension: 'analyze', tags: ['导数', '极值'] },
  { id: 'math-007', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '理解数列的概念，掌握等差、等比数列的通项公式', cognitive_dimension: 'remember', tags: ['数列', '等差', '等比'] },
  { id: 'math-008', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '能求等差、等比数列的前 n 项和', cognitive_dimension: 'apply', tags: ['数列', '求和'] },
  { id: 'math-009', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '理解概率的基本概念，掌握古典概型', cognitive_dimension: 'understand', tags: ['概率', '统计'] },
  { id: 'math-010', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '能利用排列组合方法解决计数问题', cognitive_dimension: 'apply', tags: ['排列', '组合'] },
  { id: 'math-011', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '掌握直线与圆的方程及位置关系', cognitive_dimension: 'apply', tags: ['解析几何', '直线', '圆'] },
  { id: 'math-012', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '理解椭圆、抛物线、双曲线的标准方程与几何性质', cognitive_dimension: 'understand', tags: ['圆锥曲线'] },
  { id: 'math-013', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '能综合运用解析几何方法解决综合题', cognitive_dimension: 'evaluate', tags: ['解析几何', '综合'] },
  { id: 'math-014', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '理解向量的概念，掌握向量的加减法与数乘运算', cognitive_dimension: 'understand', tags: ['向量'] },
  { id: 'math-015', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '能利用向量方法解决平面几何问题', cognitive_dimension: 'apply', tags: ['向量', '几何'] },
  { id: 'math-016', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '掌握三角函数的定义、图像和基本性质', cognitive_dimension: 'remember', tags: ['三角函数'] },
  { id: 'math-017', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '能利用三角恒等变换化简与求值', cognitive_dimension: 'apply', tags: ['三角恒等变换'] },
  { id: 'math-018', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '能设计数学模型解决实际问题', cognitive_dimension: 'create', tags: ['建模', '应用'] },
  { id: 'math-019', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '掌握不等式的基本性质与解法', cognitive_dimension: 'apply', tags: ['不等式'] },
  { id: 'math-020', library_id: 'lib-math', subject: '数学', grade_level: '高中', description: '能对数学证明过程进行评价与纠错', cognitive_dimension: 'evaluate', tags: ['证明', '逻辑'] },
  { id: 'math-021', library_id: 'lib-math', subject: '数学', grade_level: '初中', description: '理解整式、分式的概念与运算规则', cognitive_dimension: 'understand', tags: ['代数式', '初中'] },
  { id: 'math-022', library_id: 'lib-math', subject: '数学', grade_level: '初中', description: '能解一元一次方程、二元一次方程组', cognitive_dimension: 'apply', tags: ['方程', '初中'] },
  { id: 'math-023', library_id: 'lib-math', subject: '数学', grade_level: '初中', description: '理解勾股定理并能应用于实际计算', cognitive_dimension: 'apply', tags: ['几何', '勾股定理', '初中'] },
  { id: 'math-024', library_id: 'lib-math', subject: '数学', grade_level: '初中', description: '掌握平行四边形、菱形、矩形的性质与判定', cognitive_dimension: 'remember', tags: ['几何', '四边形', '初中'] },
  { id: 'math-025', library_id: 'lib-math', subject: '数学', grade_level: '初中', description: '能计算圆的周长、面积及弧长、扇形面积', cognitive_dimension: 'apply', tags: ['圆', '初中'] },

  // ─── 人工智能 ─────────────────────────────────────────────────────────────
  { id: 'ai-001', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '理解机器学习的基本概念：监督/无监督/强化学习的区别', cognitive_dimension: 'understand', tags: ['机器学习', '基础'] },
  { id: 'ai-002', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '掌握线性回归模型的原理、损失函数与梯度下降', cognitive_dimension: 'apply', tags: ['线性回归', '优化'] },
  { id: 'ai-003', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '能分析过拟合与欠拟合的原因并选择合适的正则化方法', cognitive_dimension: 'analyze', tags: ['泛化', '正则化'] },
  { id: 'ai-004', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '理解神经网络的基本结构：感知机、全连接层、激活函数', cognitive_dimension: 'understand', tags: ['神经网络', '深度学习'] },
  { id: 'ai-005', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '掌握反向传播算法的推导过程', cognitive_dimension: 'apply', tags: ['反向传播', '优化'] },
  { id: 'ai-006', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '理解卷积神经网络的结构与在图像识别中的应用', cognitive_dimension: 'understand', tags: ['CNN', '计算机视觉'] },
  { id: 'ai-007', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '能设计并实现一个图像分类任务的 CNN 模型', cognitive_dimension: 'create', tags: ['CNN', '实战'] },
  { id: 'ai-008', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '理解 Transformer 架构中的注意力机制原理', cognitive_dimension: 'understand', tags: ['Transformer', 'Attention'] },
  { id: 'ai-009', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '能描述大型语言模型（LLM）的预训练与微调流程', cognitive_dimension: 'understand', tags: ['LLM', 'NLP'] },
  { id: 'ai-010', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '能评估不同提示工程策略对 LLM 输出质量的影响', cognitive_dimension: 'evaluate', tags: ['Prompt Engineering', 'LLM'] },
  { id: 'ai-011', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '理解决策树、随机森林、XGBoost 的工作原理', cognitive_dimension: 'understand', tags: ['集成学习', '树模型'] },
  { id: 'ai-012', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '掌握 k-means 聚类与 DBSCAN 的算法原理与应用场景', cognitive_dimension: 'apply', tags: ['聚类', '无监督'] },
  { id: 'ai-013', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '理解 AI 伦理：偏见、公平性与可解释性问题', cognitive_dimension: 'analyze', tags: ['AI伦理', '可解释性'] },
  { id: 'ai-014', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '能搭建端到端的机器学习流水线（数据→训练→评估→部署）', cognitive_dimension: 'create', tags: ['MLOps', '工程'] },
  { id: 'ai-015', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '掌握混淆矩阵、精确率、召回率、F1 等评估指标的含义与计算', cognitive_dimension: 'apply', tags: ['模型评估', '指标'] },
  { id: 'ai-016', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '能对比不同优化器（SGD/Adam/RMSProp）的收敛特性', cognitive_dimension: 'analyze', tags: ['优化器', '深度学习'] },
  { id: 'ai-017', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '理解生成对抗网络（GAN）的训练机制', cognitive_dimension: 'understand', tags: ['GAN', '生成模型'] },
  { id: 'ai-018', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '掌握循环神经网络（RNN）与 LSTM 处理序列数据的方法', cognitive_dimension: 'apply', tags: ['RNN', 'LSTM', '时序'] },
  { id: 'ai-019', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '能设计 RAG 系统并评估检索增强生成的效果', cognitive_dimension: 'create', tags: ['RAG', '向量数据库'] },
  { id: 'ai-020', library_id: 'lib-ai', subject: '人工智能', grade_level: '大学', description: '理解强化学习的马尔可夫决策过程与 Q-learning 基础', cognitive_dimension: 'understand', tags: ['强化学习', 'RL'] },
]

export const OBJECTIVE_LIBRARIES = [
  { id: 'lib-math', name: '高中数学目标库', subject: '数学', grade_level: '高中/初中' },
  { id: 'lib-ai', name: '人工智能目标库', subject: '人工智能', grade_level: '大学' },
]

export function seedObjectives(db: import('better-sqlite3').Database) {
  const insertLib = db.prepare(`INSERT OR IGNORE INTO objective_libraries (id,name,subject,grade_level) VALUES (?,?,?,?)`)
  const insertObj = db.prepare(`INSERT OR IGNORE INTO learning_objectives (id,library_id,subject,grade_level,description,cognitive_dimension,tags) VALUES (?,?,?,?,?,?,?)`)
  const seed = db.transaction(() => {
    for (const lib of OBJECTIVE_LIBRARIES) {
      insertLib.run(lib.id, lib.name, lib.subject, lib.grade_level)
    }
    for (const obj of OBJECTIVES_SEED) {
      insertObj.run(obj.id, obj.library_id, obj.subject, obj.grade_level, obj.description, obj.cognitive_dimension, JSON.stringify(obj.tags))
    }
  })
  seed()
}
