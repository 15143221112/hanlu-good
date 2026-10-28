<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { all, run } from '../db/db'
import { bump } from '../store/bus'

const router = useRouter()
const subjects = ref<any[]>([])
const saving = ref(false)
const msg = ref('')

const form = ref({
  title: '',
  exam_type: '月考',
  exam_date: new Date().toISOString().slice(0, 10),
  grade: '高一',
  note: ''
})
const rows = ref<any[]>([{ subject_id: 0, score: 0, full_score: 100, class_rank: null, grade_rank: null, time_used_min: null }])

async function loadSubjects() {
  subjects.value = await all(`SELECT * FROM subject ORDER BY sort_order`)
  if (subjects.value.length) rows.value[0].subject_id = subjects.value[0].id
}
onMounted(loadSubjects)

function addRow() {
  rows.value.push({ subject_id: subjects.value[0]?.id || 0, score: 0, full_score: 100, class_rank: null, grade_rank: null, time_used_min: null })
}
function removeRow(i: number) {
  if (rows.value.length > 1) rows.value.splice(i, 1)
}

async function save() {
  msg.value = ''
  if (!form.value.title.trim()) {
    msg.value = '请填写考试名称'
    return
  }
  const validRows = rows.value.filter((r) => r.subject_id && r.score !== null)
  if (!validRows.length) {
    msg.value = '请至少录入一科成绩'
    return
  }
  saving.value = true
  try {
    const total = validRows.reduce((a, r) => a + Number(r.score), 0)
    const { lastInsertRowid } = await run(
      `INSERT INTO exam(title, exam_type, exam_date, grade, full_score_total, note) VALUES (?,?,?,?,?,?)`,
      [form.value.title, form.value.exam_type, form.value.exam_date, form.value.grade, total, form.value.note || null]
    )
    for (const r of validRows) {
      await run(
        `INSERT INTO subject_score(exam_id, subject_id, score, full_score, class_rank, grade_rank, time_used_min) VALUES (?,?,?,?,?,?,?)`,
        [lastInsertRowid, r.subject_id, r.score, r.full_score, r.class_rank ?? null, r.grade_rank ?? null, r.time_used_min ?? null]
      )
    }
    bump()
    router.push('/exams/' + lastInsertRowid)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-4 space-y-4">
    <div class="flex items-center justify-between">
      <button @click="router.back()" class="text-sm text-slate-500">‹ 返回</button>
      <h2 class="text-base font-bold text-slate-800">录入考试</h2>
      <span class="w-8"></span>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
      <div>
        <label class="text-xs text-slate-500">考试名称</label>
        <input v-model="form.title" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="如：10月月考" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-slate-500">类型</label>
          <select v-model="form.exam_type" class="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm">
            <option>月考</option><option>期中</option><option>期末</option><option>单元</option><option>模拟</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-500">日期</label>
          <input v-model="form.exam_date" type="date" class="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label class="text-xs text-slate-500">年级</label>
        <input v-model="form.grade" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-xs text-slate-500">备注</label>
        <textarea v-model="form.note" rows="2" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"></textarea>
      </div>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold text-slate-600">各科成绩</span>
        <button @click="addRow" class="text-xs text-danger">+ 加一科</button>
      </div>
      <div v-for="(r, i) in rows" :key="i" class="border-t border-slate-100 py-2 first:border-t-0 space-y-2">
        <div class="flex items-center justify-between">
          <select v-model="r.subject_id" class="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
            <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <button @click="removeRow(i)" v-if="rows.length > 1" class="text-slate-300 text-xs">删</button>
        </div>
        <div class="grid grid-cols-4 gap-2">
          <div><label class="text-[10px] text-slate-400">得分</label><input v-model.number="r.score" type="number" class="mt-0.5 w-full border border-slate-200 rounded px-2 py-1.5 text-sm" /></div>
          <div><label class="text-[10px] text-slate-400">满分</label><input v-model.number="r.full_score" type="number" class="mt-0.5 w-full border border-slate-200 rounded px-2 py-1.5 text-sm" /></div>
          <div><label class="text-[10px] text-slate-400">班排</label><input v-model.number="r.class_rank" type="number" class="mt-0.5 w-full border border-slate-200 rounded px-2 py-1.5 text-sm" /></div>
          <div><label class="text-[10px] text-slate-400">年排</label><input v-model.number="r.grade_rank" type="number" class="mt-0.5 w-full border border-slate-200 rounded px-2 py-1.5 text-sm" /></div>
        </div>
      </div>
    </div>

    <p v-if="msg" class="text-danger text-sm">{{ msg }}</p>
    <button @click="save" :disabled="saving" class="w-full bg-danger text-white text-sm font-semibold py-3 rounded-xl">
      {{ saving ? '保存中…' : '保存考试' }}
    </button>
  </div>
</template>
