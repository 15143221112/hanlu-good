<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { all } from '../db/db'
import { bus } from '../store/bus'
import EChart from '../components/EChart.vue'

const lineOption = ref<Record<string, unknown>>({})
const radarOption = ref<Record<string, unknown>>({})
const stackOption = ref<Record<string, unknown>>({})
const subjLostOption = ref<Record<string, unknown>>({})
const loading = ref(true)
const hasTrend = ref(false)
const CAUSE_COLOR: Record<string, string> = { knowledge: '#f43f5e', reasoning: '#f97316', careless: '#06b6d4', time: '#94a3b8' }

async function load() {
  loading.value = true
  try {
    const scores = await all(
      `SELECT ss.subject_id, ss.score, ss.full_score, e.exam_date, s.name, s.color
       FROM subject_score ss JOIN exam e ON e.id = ss.exam_id JOIN subject s ON s.id = ss.subject_id
       ORDER BY e.exam_date ASC`
    )
    const exams = await all(`SELECT id, title, exam_date FROM exam ORDER BY exam_date ASC`)
    hasTrend.value = exams.length >= 2
    const causes = await all(
      `SELECT e.exam_date, q.cause, SUM(q.full_score - q.got_score) lost
       FROM question q JOIN exam e ON e.id = q.exam_id GROUP BY e.exam_date, q.cause`
    )

    // 折线：各科得分率
    const dates = exams.map((e) => e.exam_date.slice(5))
    const subjects = [...new Map(scores.map((s: any) => [s.subject_id, s])).values()]
    const series = subjects.map((s: any) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      connectNulls: false,
      data: dates.map((d) => {
        const hit = scores.find((x: any) => x.subject_id === s.subject_id && x.exam_date.slice(5) === d)
        return hit ? Math.round((hit.score / hit.full_score) * 100) : null
      }),
      lineStyle: { width: 2 },
      itemStyle: { color: s.color }
    }))
    lineOption.value = {
      title: { text: '各科得分率趋势(%)', left: 'center', top: 4, textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', triggerOn: 'mousemove|click', renderMode: 'richText', confine: true },
      legend: { top: 30, type: 'scroll', textStyle: { fontSize: 11 } },
      grid: { left: 40, right: 16, top: 70, bottom: 24, containLabel: true },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { fontSize: 10, formatter: '{value}%' } },
      series
    }

    // 雷达：最新一次各科得分率
    const latest = new Map<number, { name: string; color: string; rate: number }>()
    for (const s of scores) {
      latest.set(s.subject_id, { name: s.name, color: s.color, rate: Math.round((s.score / s.full_score) * 100) })
    }
    const radarData = [...latest.values()]
    radarOption.value = {
      title: { text: '最新一次各科得分率', left: 'center', top: 4, textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'item', triggerOn: 'mousemove|click', confine: true },
      radar: {
        center: ['50%', '56%'],
        radius: '62%',
        indicator: radarData.map((r) => ({ name: r.name, max: 100 })),
        axisName: { fontSize: 11 }
      },
      series: [
        {
          type: 'radar',
          data: [{ value: radarData.map((r) => r.rate), name: '最新考试' }],
          areaStyle: { opacity: 0.2 }
        }
      ]
    }

    // 堆叠柱：失分四象限随考试
    const causeKeys = ['knowledge', 'reasoning', 'careless', 'time']
    const labels: Record<string, string> = { knowledge: '知识缺漏', reasoning: '推理薄弱', careless: '粗心失误', time: '时间不足' }
    stackOption.value = {
      title: { text: '失分归因分布（分）', left: 'center', top: 4, textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', triggerOn: 'mousemove|click', renderMode: 'richText', confine: true },
      legend: { top: 30, textStyle: { fontSize: 11 } },
      grid: { left: 40, right: 16, top: 70, bottom: 24, containLabel: true },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: causeKeys.map((k) => ({
        name: labels[k],
        type: 'bar',
        stack: 'total',
        data: dates.map((d) => {
          const hit = causes.find((c: any) => c.cause === k && c.exam_date.slice(5) === d)
          return hit ? Number(hit.lost) : 0
        }),
        itemStyle: { color: CAUSE_COLOR[k] }
      }))
    }

    // 各科失分归因（堆叠柱，x=科目）——一眼看出哪科哪种问题最重
    const lostBySubj = await all(
      `SELECT q.subject_id, s.name, s.color, q.cause, SUM(q.full_score - q.got_score) lost
       FROM question q JOIN subject s ON s.id = q.subject_id
       GROUP BY q.subject_id, q.cause ORDER BY s.sort_order`
    )
    const subjMeta = [...new Map(lostBySubj.map((x: any) => [x.subject_id, x])).values()] as Array<{ subject_id: number; name: string; color: string }>
    const lostMap: Record<number, Record<string, number>> = {}
    for (const l of lostBySubj as Array<{ subject_id: number; cause: string; lost: number }>) {
      lostMap[l.subject_id] = lostMap[l.subject_id] || {}
      lostMap[l.subject_id][l.cause] = Number(l.lost)
    }
    subjLostOption.value = {
      title: { text: '各科失分归因（分）', left: 'center', top: 4, textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', triggerOn: 'mousemove|click', renderMode: 'richText', confine: true },
      legend: { top: 30, textStyle: { fontSize: 11 } },
      grid: { left: 40, right: 16, top: 70, bottom: 30, containLabel: true },
      xAxis: { type: 'category', data: subjMeta.map((x) => x.name), axisLabel: { fontSize: 11, fontWeight: 600 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: causeKeys.map((k) => ({
        name: labels[k],
        type: 'bar',
        stack: 'total',
        barMaxWidth: 30,
        data: subjMeta.map((x) => lostMap[x.subject_id]?.[k] || 0),
        itemStyle: { color: CAUSE_COLOR[k], borderRadius: k === 'time' ? [4, 4, 0, 0] : 0 }
      }))
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => bus.tick, load)
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-sm font-bold text-slate-700">趋势分析</h2>
    <div v-if="!loading && hasTrend" class="bg-white rounded-xl p-2 shadow-sm border border-slate-100" style="height: 300px">
      <EChart :option="lineOption" />
    </div>
    <div v-else-if="!loading" class="bg-white rounded-xl p-2 shadow-sm border border-slate-100 flex items-center justify-center" style="height: 300px">
      <p class="text-slate-400 text-sm">再录入一次考试，即可生成各科得分率趋势对比</p>
    </div>
    <div class="bg-white rounded-xl p-2 shadow-sm border border-slate-100" style="height: 300px">
      <EChart v-if="!loading" :option="radarOption" />
    </div>
    <div class="bg-white rounded-xl p-2 shadow-sm border border-slate-100" style="height: 300px">
      <EChart v-if="!loading" :option="stackOption" />
    </div>
    <div class="bg-white rounded-xl p-2 shadow-sm border border-slate-100" style="height: 300px">
      <EChart v-if="!loading" :option="subjLostOption" />
    </div>
  </div>
</template>
