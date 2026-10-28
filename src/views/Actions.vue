<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { all, run } from '../db/db'
import { bus, bump } from '../store/bus'
import EmptyState from '../components/EmptyState.vue'

const tab = ref<'open' | 'done'>('open')
const items = ref<any[]>([])
const subjects = ref<any[]>([])
const exams = ref<any[]>([])
const showForm = ref(false)
const msg = ref('')

const form = ref({ subject_id: 0, target_exam_id: 0, description: '', measurable: '', deadline: '' })

async function load() {
  subjects.value = await all(`SELECT * FROM subject ORDER BY sort_order`)
  exams.value = await all(`SELECT id, title FROM exam ORDER BY exam_date DESC`)
  items.value = await all(`SELECT * FROM action_item ORDER BY id DESC`)
}
async function save() {
  msg.value = ''
  if (!form.value.description.trim() || !form.value.measurable.trim()) {
    msg.value = '行动描述与可衡量标准必填'
    return
  }
  await run(
    `INSERT INTO action_item(subject_id, target_exam_id, description, measurable, deadline, status) VALUES (?,?,?,?,?,'open')`,
    [form.value.subject_id || null, form.value.target_exam_id || null, form.value.description, form.value.measurable, form.value.deadline || null]
  )
  form.value = { subject_id: 0, target_exam_id: 0, description: '', measurable: '', deadline: '' }
  showForm.value = false
  bump()
}
async function toggle(a: any) {
  await run(`UPDATE action_item SET status = ? WHERE id = ?`, [a.status === 'open' ? 'done' : 'open', a.id])
  bump()
}
onMounted(load)
watch(() => bus.tick, load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-bold text-slate-700">行动项</h2>
      <button @click="showForm = !showForm" class="bg-danger text-white text-sm font-medium px-4 py-2 rounded-full">{{ showForm ? '收起' : '+ 新建' }}</button>
    </div>

    <div v-if="showForm" class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
      <div>
        <label class="text-xs text-slate-500">行动描述（做什么）</label>
        <input v-model="form.description" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="如：化学氧化还原选择题专项训练" />
      </div>
      <div>
        <label class="text-xs text-slate-500">可衡量标准（怎么算完成）</label>
        <input v-model="form.measurable" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="如：连续3天每日20题，正确率≥80%" />
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="text-xs text-slate-500">科目</label>
          <select v-model="form.subject_id" class="mt-1 w-full border border-slate-200 rounded-lg px-1 py-2 text-sm">
            <option :value="0">不限</option>
            <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-500">目标考试</label>
          <select v-model="form.target_exam_id" class="mt-1 w-full border border-slate-200 rounded-lg px-1 py-2 text-sm">
            <option :value="0">不限</option>
            <option v-for="e in exams" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-500">截止</label>
          <input v-model="form.deadline" type="date" class="mt-1 w-full border border-slate-200 rounded-lg px-1 py-2 text-sm" />
        </div>
      </div>
      <p v-if="msg" class="text-danger text-xs">{{ msg }}</p>
      <button @click="save" class="w-full bg-danger text-white text-sm font-semibold py-2.5 rounded-lg">保存行动项</button>
    </div>

    <div class="flex gap-2">
      <button
        :class="tab === 'open' ? 'bg-danger text-white' : 'bg-white text-slate-600'"
        class="px-3 py-1.5 rounded-full text-xs border border-slate-200"
        @click="tab = 'open'"
      >待办 ({{ items.filter((i) => i.status === 'open').length }})</button>
      <button
        :class="tab === 'done' ? 'bg-success text-white' : 'bg-white text-slate-600'"
        class="px-3 py-1.5 rounded-full text-xs border border-slate-200"
        @click="tab = 'done'"
      >已完成 ({{ items.filter((i) => i.status === 'done').length }})</button>
    </div>

    <div v-if="items.some((i) => (tab === 'open' ? i.status === 'open' : i.status === 'done'))" class="space-y-3">
      <div
        v-for="a in items.filter((i) => (tab === 'open' ? i.status === 'open' : i.status === 'done'))"
        :key="a.id"
        class="bg-white rounded-xl p-4 shadow-sm border border-slate-100"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1">
            <div class="text-sm font-medium" :class="a.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'">{{ a.description }}</div>
            <div class="text-xs text-slate-500 mt-1">可衡量：{{ a.measurable }}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">
              <template v-if="a.subject_id">科目关联 · </template>
              <template v-if="a.deadline">截止 {{ a.deadline }}</template>
            </div>
          </div>
          <button
            @click="toggle(a)"
            :class="a.status === 'open' ? 'bg-success/10 text-success border-success' : 'bg-slate-100 text-slate-500 border-slate-200'"
            class="shrink-0 text-xs px-3 py-1.5 rounded-full border"
          >{{ a.status === 'open' ? '标完成' : '重开' }}</button>
        </div>
      </div>
    </div>
    <EmptyState v-else title="这里空空的" desc="制定一条可衡量的提分行动，下次考试见效果" :steps="['写清做什么（如 每天背10个单词）', '设一个可衡量的标准（正确率≥80%）', '定截止日期，到期复查']" />
  </div>
</template>
