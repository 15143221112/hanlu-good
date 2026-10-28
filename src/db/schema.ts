// SQLite 建表 DDL 与预置数据
// 直接来自 PRD 第 3 节，补充必要索引

export const SCHEMA_SQL = `
-- 学科
CREATE TABLE IF NOT EXISTS subject (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  grade TEXT NOT NULL,
  full_score_total REAL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS subject_score (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subject(id),
  score REAL NOT NULL,
  full_score REAL NOT NULL,
  class_rank INTEGER,
  grade_rank INTEGER,
  time_used_min INTEGER,
  note TEXT,
  UNIQUE(exam_id, subject_id)
);

CREATE TABLE IF NOT EXISTS knowledge_point (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subject(id),
  chapter TEXT NOT NULL,
  topic TEXT NOT NULL,
  UNIQUE(subject_id, chapter, topic)
);

CREATE TABLE IF NOT EXISTS question (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subject(id),
  q_no TEXT,
  q_type TEXT NOT NULL,
  full_score REAL,
  got_score REAL,
  cause TEXT NOT NULL CHECK(cause IN ('knowledge','reasoning','careless','time')),
  status TEXT NOT NULL DEFAULT 'new',
  image_id TEXT,
  my_wrong_answer TEXT,
  correct_answer TEXT,
  my_note TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS question_kp (
  question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  kp_id INTEGER NOT NULL REFERENCES knowledge_point(id) ON DELETE CASCADE,
  PRIMARY KEY(question_id, kp_id)
);

CREATE TABLE IF NOT EXISTS review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  review_date TEXT NOT NULL,
  result TEXT NOT NULL,
  next_review_date TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS action_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER REFERENCES subject(id),
  target_exam_id INTEGER REFERENCES exam(id),
  description TEXT NOT NULL,
  measurable TEXT NOT NULL,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS exam_meta (
  exam_id INTEGER PRIMARY KEY REFERENCES exam(id) ON DELETE CASCADE,
  sleep_hours REAL,
  mood INTEGER,
  health TEXT,
  time_distribution TEXT,
  parent_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_score_exam ON subject_score(exam_id);
CREATE INDEX IF NOT EXISTS idx_score_subject ON subject_score(subject_id);
CREATE INDEX IF NOT EXISTS idx_question_exam ON question(exam_id);
CREATE INDEX IF NOT EXISTS idx_question_subject ON question(subject_id);
CREATE INDEX IF NOT EXISTS idx_question_status ON question(status);
CREATE INDEX IF NOT EXISTS idx_action_status ON action_item(status);
`

export const PRESET_SQL = `
INSERT INTO subject(code,name,color,sort_order) VALUES
('MATH','数学','#6366f1',1),
('CHN','语文','#f43f5e',2),
('ENG','英语','#10b981',3),
('PHY','物理','#8b5cf6',4),
('CHEM','化学','#f97316',5),
('BIO','生物','#06b6d4',6)
ON CONFLICT(code) DO UPDATE SET name=excluded.name, color=excluded.color, sort_order=excluded.sort_order;

INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第一章 物质及其变化', '物质的分类及转化' FROM subject WHERE code='CHEM';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第一章 物质及其变化', '离子反应' FROM subject WHERE code='CHEM';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第一章 物质及其变化', '氧化还原反应' FROM subject WHERE code='CHEM';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第二章 海水中的重要元素—钠和氯', '钠及其化合物' FROM subject WHERE code='CHEM';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第二章 海水中的重要元素—钠和氯', '氯及其化合物' FROM subject WHERE code='CHEM';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第二章 海水中的重要元素—钠和氯', '物质的量' FROM subject WHERE code='CHEM';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第三章 铁 金属材料', '铁及其化合物' FROM subject WHERE code='CHEM';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第三章 铁 金属材料', '金属材料' FROM subject WHERE code='CHEM';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第四章 物质结构 元素周期律', '原子结构与元素周期表' FROM subject WHERE code='CHEM';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第四章 物质结构 元素周期律', '元素周期律' FROM subject WHERE code='CHEM';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '第四章 物质结构 元素周期律', '化学键' FROM subject WHERE code='CHEM';
`

// 预置高一数学/物理/生物常用知识点（便于错题归类，可设置页增删）
export const PRESET_MORE_KP_SQL = `
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '集合与常用逻辑用语', '集合运算' FROM subject WHERE code='MATH';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '集合与常用逻辑用语', '充分必要条件' FROM subject WHERE code='MATH';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '函数', '函数概念与单调性' FROM subject WHERE code='MATH';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '函数', '二次函数与不等式' FROM subject WHERE code='MATH';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '运动学', '匀变速直线运动' FROM subject WHERE code='PHY';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '运动学', '追及相遇' FROM subject WHERE code='PHY';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '运动学', '运动图像' FROM subject WHERE code='PHY';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '相互作用', '摩擦力' FROM subject WHERE code='PHY';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '相互作用', '弹力与胡克定律' FROM subject WHERE code='PHY';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '细胞与分子', '细胞学说' FROM subject WHERE code='BIO';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '细胞与分子', '蛋白质与核酸' FROM subject WHERE code='BIO';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '细胞与分子', '糖类和脂质' FROM subject WHERE code='BIO';
INSERT OR IGNORE INTO knowledge_point(subject_id, chapter, topic) SELECT id, '细胞与分子', '水和无机盐' FROM subject WHERE code='BIO';
`
