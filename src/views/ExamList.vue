<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { all } from '../db/db'
import { bus } from '../store/bus'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const exams = ref<any[]>([])
const loading = ref(true)

function fmt(d: string) {
  return d ? d.slice(0, 10) : ''
}
function rate(total: number, full: number) {
  return full ? Math.round((total / full) * 100) : 0
}

async function load() {
  loading.value = true
  try {
    const list = await all(`SELECT * FROM exam ORDER BY exam_date DESC, id DESC`)
    const sc = await all(`SELECT ss.exam_id, ss.score, ss.full_score, s.name, s.color, s.sort_order
      FROM subject_score ss JOIN subject s ON s.id = ss.subject_id ORDER BY s.sort_order`)
    const byExam: Record<number, any[]> = {}
    for (const r of sc) {
      ;(byExam[r.exam_id] ||= []).push(r)
    }
    exams.value = list.map((e) => ({ ...e, subjects: byExam[e.id] || [] }))
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => bus.tick, load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-bold text-slate-700">考试记录</h2>
      <button @click="router.push('/exams/new')" class="bg-danger text-white text-sm font-medium px-4 py-2 rounded-full">+ 新增考试</button>
    </div>

    <div v-if="exams.length" class="space-y-3">
      <div
        v-for="e in exams"
        :key="e.id"
        class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer"
        @click="router.push('/exams/' + e.id)"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="text-sm font-bold text-slate-800">{{ e.title }}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">{{ e.exam_type }} · {{ fmt(e.exam_date) }}</div>
          </div>
          <div class="text-right">
            <div class="text-lg font-black text-danger">{{ e.full_score_total ?? '—' }}</div>
            <div class="text-[11px] text-slate-400">总分</div>
          </div>
        </div>
        <div v-if="e.subjects.length" class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="s in e.subjects"
            :key="s.name"
            class="text-[11px] px-2 py-0.5 rounded-full"
            :style="{ background: s.color + '1a', color: s.color }"
          >
            {{ s.name }} {{ s.score }}/{{ s.full_score }} ({{ rate(s.score, s.full_score) }}%)
          </span>
        </div>
      </div>
    </div>
    <EmptyState v-else title="还没有考试" desc="点「+ 新增考试」录入第一次月考" :steps="['填考试名称、日期和年级', '填六科成绩和满分（如 数学 83/150）', '保存后首页和趋势页自动出图']" />
  </div>
</template>
