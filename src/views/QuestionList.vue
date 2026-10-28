<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { all, run } from '../db/db'
import { bus, bump } from '../store/bus'
import { today, addDays } from '../utils/date'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const subjects = ref<any[]>([])
const active = ref(0)
const questions = ref<any[]>([])
const logs = ref<any[]>([])

const CAUSE_LABEL: Record<string, string> = { knowledge: '知识缺漏', reasoning: '推理薄弱', careless: '粗心失误', time: '时间不足' }
const CAUSE_COLOR: Record<string, string> = { knowledge: '#dc2626', reasoning: '#ea580c', careless: '#0891b2', time: '#94a3b8' }

const filtered = computed(() => {
  if (!active.value) return questions.value
  return questions.value.filter((q) => q.subject_id === active.value)
})

async function load() {
  subjects.value = await all(`SELECT * FROM subject ORDER BY sort_order`)
  questions.value = await all(`SELECT q.*, s.name sname, s.color scolor FROM question q JOIN subject s ON s.id=q.subject_id ORDER BY q.id DESC`)
  logs.value = await all(`SELECT question_id, MAX(id) mid, next_review_date FROM review_log GROUP BY question_id`)
  const byQ: Record<number, any> = {}
  for (const l of logs.value) byQ[l.question_id] = l
  questions.value.forEach((q) => {
    q.review = byQ[q.id]
    if (q.review && q.review.next_review_date) {
      q.due = q.review.next_review_date <= today() ? -1 : 0
    } else {
      q.due = null
    }
  })
}

async function reviewAgain(q: any) {
  const count = logs.value.filter((l) => l.question_id === q.id).length
  const days = [1, 3, 7, 15, 30, 60]
  const next = days[Math.min(count, days.length - 1)]
  await run(
    `INSERT INTO review_log(question_id, review_date, result, next_review_date) VALUES (?,?,?,?)`,
    [q.id, today(), 'ok', addDays(today(), next)]
  )
  await run(`UPDATE question SET status='review' WHERE id=?`, [q.id])
  bump()
}

async function markMastered(q: any) {
  await run(`UPDATE question SET status='mastered' WHERE id=?`, [q.id])
  bump()
}

async function resetReview(q: any) {
  await run(`INSERT INTO review_log(question_id, review_date, result, next_review_date) VALUES (?,?,?,?)`, [q.id, today(), 'fail', addDays(today(), 1)])
  await run(`UPDATE question SET status='new' WHERE id=?`, [q.id])
  bump()
}

onMounted(load)
watch(() => bus.tick, load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-bold text-slate-700">错题本</h2>
      <button @click="router.push('/questions/new')" class="bg-danger text-white text-sm font-medium px-4 py-2 rounded-full">+ 记错题</button>
    </div>

    <!-- 科目筛选 -->
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button
        :class="active === 0 ? 'bg-danger text-white' : 'bg-white text-slate-600'"
        class="px-3 py-1.5 rounded-full text-xs whitespace-nowrap border border-slate-200"
        @click="active = 0"
      >全部</button>
      <button
        v-for="s in subjects"
        :key="s.id"
        :class="active === s.id ? 'text-white' : 'text-slate-600 bg-white'"
        :style="active === s.id ? { background: s.color } : {}"
        class="px-3 py-1.5 rounded-full text-xs whitespace-nowrap border border-slate-200"
        @click="active = s.id"
      >{{ s.name }}</button>
    </div>

    <div v-if="filtered.length" class="space-y-3">
      <div v-for="q in filtered" :key="q.id" class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold" :style="{ color: q.scolor }">{{ q.sname }}</span>
          <span class="text-xs text-slate-400">{{ q.q_type }}{{ q.q_no ? ' · ' + q.q_no : '' }}</span>
        </div>
        <div class="flex items-center gap-2 mt-2 flex-wrap">
          <span class="text-xs px-2 py-0.5 rounded-full" :style="{ background: CAUSE_COLOR[q.cause] + '1a', color: CAUSE_COLOR[q.cause] }">
            {{ CAUSE_LABEL[q.cause] }} · 丢 {{ q.full_score - q.got_score }} 分
          </span>
          <span
            v-if="q.due === -1"
            class="text-xs px-2 py-0.5 rounded-full bg-danger text-white"
          >今日该复习</span>
          <span v-else-if="q.status === 'mastered'" class="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">已掌握</span>
          <span v-else class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">复习中</span>
        </div>
        <div v-if="q.my_note" class="text-xs text-slate-500 mt-2">{{ q.my_note }}</div>
        <div class="flex gap-2 mt-3">
          <button v-if="q.status !== 'mastered'" @click="reviewAgain(q)" class="text-xs flex-1 py-1.5 rounded-lg border border-success text-success">记住了，继续</button>
          <button v-if="q.status !== 'mastered'" @click="resetReview(q)" class="text-xs flex-1 py-1.5 rounded-lg border border-warning text-warning">还不会，重置</button>
          <button v-if="q.status !== 'mastered'" @click="markMastered(q)" class="text-xs flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-500">标为已掌握</button>
        </div>
      </div>
    </div>
    <EmptyState v-else title="还没有错题" desc="点「+ 记错题」把丢分题录进来，按艾宾浩斯复习" :steps="['选科目和考试', '填题号、得失分和失分原因', '标「待复习」，系统帮你规划复习节奏']" />
  </div>
</template>
