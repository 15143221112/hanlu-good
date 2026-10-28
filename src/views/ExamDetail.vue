<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { all, run, get } from '../db/db'
import { bus, bump } from '../store/bus'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)
const exam = ref<any>(null)
const scores = ref<any[]>([])
const questions = ref<any[]>([])
const causes = ref<any[]>([])
const loading = ref(true)

const CAUSES = [
  { key: 'knowledge', label: '知识缺漏', color: '#f43f5e' },
  { key: 'reasoning', label: '推理薄弱', color: '#f97316' },
  { key: 'careless', label: '粗心失误', color: '#06b6d4' },
  { key: 'time', label: '时间不足', color: '#94a3b8' }
]

function fmt(d: string) {
  return d ? d.slice(0, 10) : ''
}

async function load() {
  loading.value = true
  try {
    exam.value = (await get(`SELECT * FROM exam WHERE id = ?`, [id])) || null
    if (!exam.value) return
    scores.value = await all(
      `SELECT ss.*, s.name, s.color FROM subject_score ss JOIN subject s ON s.id = ss.subject_id
       WHERE ss.exam_id = ? ORDER BY s.sort_order`,
      [id]
    )
    // 上一场考试各科得分率（对比）
    const prev = await all(
      `SELECT ss.subject_id, ss.score, ss.full_score, e.exam_date
       FROM subject_score ss JOIN exam e ON e.id = ss.exam_id
       WHERE e.exam_date < ? ORDER BY e.exam_date DESC`,
      [exam.value.exam_date]
    )
    const prevBy: Record<number, any> = {}
    for (const p of prev) if (!prevBy[p.subject_id]) prevBy[p.subject_id] = p
    scores.value.forEach((s) => {
      const p = prevBy[s.subject_id]
      s.prevRate = p ? Math.round((p.score / p.full_score) * 100) : null
      s.rate = Math.round((s.score / s.full_score) * 100)
    })
    questions.value = await all(`SELECT q.* FROM question q WHERE q.exam_id = ? ORDER BY q.id`, [id])
    causes.value = await all(
      `SELECT cause, COUNT(*) c, SUM(full_score - got_score) lost FROM question WHERE exam_id = ? GROUP BY cause`,
      [id]
    )
  } finally {
    loading.value = false
  }
}

async function removeExam() {
  if (!confirm(`确定删除「${exam.value?.title}」吗？其下所有错题将一并删除。`)) return
  await run(`DELETE FROM exam WHERE id = ?`, [id])
  bump()
  router.push('/exams')
}

onMounted(load)
watch(() => bus.tick, load)
</script>

<template>
  <div v-if="exam" class="space-y-4">
    <div class="flex items-center justify-between">
      <button @click="router.push('/exams')" class="text-sm text-slate-500">‹ 返回</button>
      <h2 class="text-base font-bold text-slate-800">{{ exam.title }}</h2>
      <button @click="removeExam" class="text-xs text-slate-400">删除</button>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs text-slate-400">{{ exam.exam_type }} · {{ fmt(exam.exam_date) }} · {{ exam.grade }}</div>
          <div class="text-3xl font-black text-danger mt-1">{{ exam.full_score_total ?? '—' }}</div>
        </div>
        <div v-if="exam.note" class="text-xs text-slate-400 max-w-[50%]">{{ exam.note }}</div>
      </div>
    </div>

    <!-- 各科得分与趋势 -->
    <section class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <h3 class="text-xs font-bold text-slate-600 mb-2">各科得分</h3>
      <div class="divide-y divide-slate-100">
        <div v-for="s in scores" :key="s.subject_id" class="py-2 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full" :style="{ background: s.color }"></span>
            <span class="text-sm">{{ s.name }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="s.prevRate !== null" class="text-[11px]" :class="s.rate > s.prevRate ? 'text-success' : s.rate < s.prevRate ? 'text-danger' : 'text-slate-400'">
              {{ s.rate > s.prevRate ? '↑' : s.rate < s.prevRate ? '↓' : '—' }}{{ s.prevRate }}%
            </span>
            <span class="text-sm font-bold">{{ s.score }}/{{ s.full_score }}</span>
            <span class="text-[11px] text-slate-400">({{ s.rate }}%)</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 失分四象限 -->
    <section class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <h3 class="text-xs font-bold text-slate-600 mb-2">失分归因（错题）</h3>
      <div v-if="causes.length" class="grid grid-cols-2 gap-2">
        <div v-for="c in CAUSES" :key="c.key" class="rounded-lg p-3 border" :style="{ borderColor: c.color + '40', background: c.color + '0d' }">
          <div class="text-[11px] text-slate-500">{{ c.label }}</div>
          <div class="text-xl font-black" :style="{ color: c.color }">
            {{ causes.find((x) => x.cause === c.key)?.lost ?? 0 }}
            <span class="text-[10px] text-slate-400">分</span>
          </div>
          <div class="text-[11px] text-slate-400">{{ causes.find((x) => x.cause === c.key)?.c ?? 0 }} 题</div>
        </div>
      </div>
      <p v-else class="text-xs text-slate-400">本场暂无错题记录</p>
    </section>

    <!-- 错题列表 -->
    <section>
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-bold text-slate-600">本场错题（{{ questions.length }}）</h3>
        <button @click="router.push('/questions/new?exam_id=' + id)" class="text-xs text-danger">+ 记错题</button>
      </div>
      <div v-if="questions.length" class="space-y-2">
        <div v-for="q in questions" :key="q.id" class="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
          <div class="flex justify-between">
            <span class="text-sm font-medium">{{ q.q_type }}{{ q.q_no ? ' · ' + q.q_no : '' }}</span>
            <span class="text-xs text-slate-500">{{ q.full_score - q.got_score }} 分</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-1">
            得分 {{ q.got_score }}/{{ q.full_score }} · 状态 {{ q.status === 'mastered' ? '已掌握' : q.status === 'review' ? '复习中' : '待处理' }}
          </div>
        </div>
      </div>
      <EmptyState v-else title="还没有错题" desc="点「+ 记错题」把本次错题录进来，才能做归因和复习" />
    </section>
  </div>
</template>
