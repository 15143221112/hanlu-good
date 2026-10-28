<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { all } from '../db/db'
import { bus } from '../store/bus'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const loading = ref(true)
const lastExam = ref<any>(null)
const scores = ref<any[]>([])
const actions = ref<any[]>([])
const pendingQ = ref(0)
const masteredQ = ref(0)

function fmt(d: string) {
  return d ? d.slice(0, 10) : ''
}

async function load() {
  loading.value = true
  try {
    lastExam.value = (await all(`SELECT * FROM exam ORDER BY exam_date DESC, id DESC LIMIT 1`))[0] || null
    if (lastExam.value) {
      scores.value = await all(
        `SELECT ss.*, s.name, s.color FROM subject_score ss
         JOIN subject s ON s.id = ss.subject_id WHERE ss.exam_id = ?
         ORDER BY s.sort_order`,
        [lastExam.value.id]
      )
    } else {
      scores.value = []
    }
    actions.value = await all(`SELECT * FROM action_item WHERE status = 'open' ORDER BY id DESC LIMIT 3`)
    const qc = await all(`SELECT status, COUNT(*) c FROM question GROUP BY status`)
    pendingQ.value = qc.reduce((a, r) => a + (r.status !== 'mastered' ? Number(r.c) : 0), 0)
    masteredQ.value = qc.reduce((a, r) => a + (r.status === 'mastered' ? Number(r.c) : 0), 0)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => bus.tick, load)
</script>

<template>
  <div class="space-y-5">
    <!-- 最近考试 -->
    <section>
      <div v-if="lastExam" class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs text-slate-400">{{ lastExam.exam_type }} · {{ fmt(lastExam.exam_date) }}</div>
            <div class="text-xl font-bold mt-0.5">{{ lastExam.title }}</div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-black text-danger">{{ lastExam.full_score_total ?? '—' }}</div>
            <div class="text-[11px] text-slate-400">总分</div>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2">
          <div v-for="s in scores" :key="s.subject_id" class="rounded-xl p-2 text-center" :style="{ background: s.color + '1a' }">
            <div class="text-[10px] text-slate-500">{{ s.name }}</div>
            <div class="text-sm font-bold truncate" :style="{ color: s.color }">{{ s.score }}<span class="text-[10px] text-slate-400">/{{ s.full_score }}</span></div>
          </div>
        </div>
      </div>
      <div v-else class="bg-white rounded-2xl shadow-sm border border-slate-100">
        <EmptyState
          title="还没有考试记录"
          desc="录入第一次月考，开始建立女儿的学习轨迹"
          :steps="['点「录入考试」填科目和分数', '再点「记录错题」把失分的题录进来', '趋势页自动生成各科得分率与失分归因']"
        />
        <div class="pb-4 text-center -mt-6">
          <button @click="router.push('/exams/new')" class="text-danger text-sm font-medium">+ 录入第一次考试</button>
        </div>
      </div>
    </section>

    <!-- 快捷入口 -->
    <section class="grid grid-cols-2 gap-3">
      <button @click="router.push('/exams/new')" class="bg-white border border-slate-100 rounded-xl py-3 shadow-sm text-sm font-medium text-slate-700">+ 录入考试</button>
      <button @click="router.push('/questions/new')" class="bg-white border border-slate-100 rounded-xl py-3 shadow-sm text-sm font-medium text-slate-700">+ 记录错题</button>
    </section>

    <!-- 待办概览 -->
    <section class="grid grid-cols-3 gap-3">
      <div class="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center">
        <div class="text-2xl font-black text-warning">{{ actions.length }}</div>
        <div class="text-[11px] text-slate-400">待办行动项</div>
      </div>
      <div class="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center">
        <div class="text-2xl font-black text-danger">{{ pendingQ }}</div>
        <div class="text-[11px] text-slate-400">未掌握错题</div>
      </div>
      <div class="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center">
        <div class="text-2xl font-black text-success">{{ masteredQ }}</div>
        <div class="text-[11px] text-slate-400">已掌握</div>
      </div>
    </section>

    <!-- 待办行动项 -->
    <section>
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-bold text-slate-700">待办行动项</h2>
        <button @click="router.push('/actions')" class="text-xs text-danger">全部 ›</button>
      </div>
      <div v-if="actions.length" class="space-y-2">
        <div v-for="a in actions" :key="a.id" class="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
          <div class="text-sm">{{ a.description }}</div>
          <div class="text-[11px] text-slate-400 mt-1">可衡量：{{ a.measurable }}<span v-if="a.deadline"> · 截止 {{ a.deadline }}</span></div>
        </div>
      </div>
      <EmptyState v-else title="暂无待办" desc="去「行动项」制定下阶段的提分任务" />
    </section>
  </div>
</template>
