<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { all, run } from '../db/db'
import { compressImage, saveImage, objectURL } from '../db/imgdb'
import { bump } from '../store/bus'

const route = useRoute()
const router = useRouter()
const subjects = ref<any[]>([])
const exams = ref<any[]>([])
const kps = ref<any[]>([])
const saving = ref(false)
const msg = ref('')

const form = ref({
  subject_id: 0,
  exam_id: route.query.exam_id ? Number(route.query.exam_id) : 0,
  q_type: '选择题',
  q_no: '',
  full_score: 10,
  got_score: 0,
  cause: 'knowledge',
  my_wrong_answer: '',
  correct_answer: '',
  my_note: ''
})
const selectedKp = ref<number[]>([])
const newKp = ref('')
const imageId = ref<string | null>(null)
const imagePreview = ref<string | null>(null)

const CAUSES = [
  { key: 'knowledge', label: '知识缺漏' },
  { key: 'reasoning', label: '推理薄弱' },
  { key: 'careless', label: '粗心失误' },
  { key: 'time', label: '时间不足' }
]

async function loadSubjects() {
  subjects.value = await all(`SELECT * FROM subject ORDER BY sort_order`)
  if (subjects.value.length && !form.value.subject_id) form.value.subject_id = subjects.value[0].id
  exams.value = await all(`SELECT id, title, exam_date FROM exam ORDER BY exam_date DESC`)
  await loadKp()
}
async function loadKp() {
  if (!form.value.subject_id) return
  kps.value = await all(`SELECT * FROM knowledge_point WHERE subject_id = ? ORDER BY chapter, topic`, [form.value.subject_id])
}
watch(() => form.value.subject_id, loadKp)
onMounted(loadSubjects)

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const blob = await compressImage(file)
    const id = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    await saveImage(id, blob)
    imageId.value = id
    imagePreview.value = await objectURL(id)
  } catch (err) {
    msg.value = '图片处理失败：' + (err as Error).message
  }
}

async function addNewKp() {
  const t = newKp.value.trim()
  if (!t || !form.value.subject_id) return
  const exist = kps.value.find((k) => k.topic === t)
  let kpId = exist?.id
  if (!kpId) {
    const { lastInsertRowid } = await run(
      `INSERT INTO knowledge_point(subject_id, chapter, topic) VALUES (?,?,?)`,
      [form.value.subject_id, '自定义', t]
    )
    kpId = lastInsertRowid
  }
  if (!selectedKp.value.includes(kpId)) selectedKp.value.push(kpId)
  newKp.value = ''
  await loadKp()
}

async function save() {
  msg.value = ''
  if (!form.value.subject_id) {
    msg.value = '请选择科目'
    return
  }
  if (form.value.got_score === null || form.value.full_score === null) {
    msg.value = '请填写得分与满分'
    return
  }
  saving.value = true
  try {
    const { lastInsertRowid } = await run(
      `INSERT INTO question(exam_id, subject_id, q_no, q_type, full_score, got_score, cause, image_id, my_wrong_answer, correct_answer, my_note, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'new')`,
      [
        form.value.exam_id || null,
        form.value.subject_id,
        form.value.q_no || null,
        form.value.q_type,
        form.value.full_score,
        form.value.got_score,
        form.value.cause,
        imageId.value,
        form.value.my_wrong_answer || null,
        form.value.correct_answer || null,
        form.value.my_note || null
      ]
    )
    for (const kpId of selectedKp.value) {
      await run(`INSERT OR IGNORE INTO question_kp(question_id, kp_id) VALUES (?,?)`, [lastInsertRowid, kpId])
    }
    bump()
    if (form.value.exam_id) router.push('/exams/' + form.value.exam_id)
    else router.push('/questions')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-4 space-y-4">
    <div class="flex items-center justify-between">
      <button @click="router.back()" class="text-sm text-slate-500">‹ 返回</button>
      <h2 class="text-base font-bold text-slate-800">记错题</h2>
      <span class="w-8"></span>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-slate-500">科目</label>
          <select v-model="form.subject_id" class="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm">
            <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-500">所属考试（可空）</label>
          <select v-model="form.exam_id" class="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm">
            <option :value="0">不关联</option>
            <option v-for="e in exams" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-4 gap-2">
        <div>
          <label class="text-xs text-slate-500">题型</label>
          <select v-model="form.q_type" class="mt-1 w-full border border-slate-200 rounded-lg px-1 py-2 text-sm">
            <option>选择题</option><option>填空题</option><option>解答题</option><option>实验题</option><option>其他</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-500">题号</label>
          <input v-model="form.q_no" class="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm" placeholder="如 18" />
        </div>
        <div>
          <label class="text-xs text-slate-500">满分</label>
          <input v-model.number="form.full_score" type="number" class="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm" />
        </div>
        <div>
          <label class="text-xs text-slate-500">得分</label>
          <input v-model.number="form.got_score" type="number" class="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label class="text-xs text-slate-500">失分原因</label>
        <div class="grid grid-cols-4 gap-2 mt-1">
          <button
            v-for="c in CAUSES"
            :key="c.key"
            @click="form.cause = c.key"
            :class="form.cause === c.key ? 'border-danger text-danger bg-danger/5' : 'border-slate-200 text-slate-500'"
            class="px-2 py-1.5 rounded-lg border text-xs"
          >{{ c.label }}</button>
        </div>
      </div>

      <div>
        <label class="text-xs text-slate-500">知识点（可多选）</label>
        <div class="flex flex-wrap gap-1.5 mt-1.5">
          <button
            v-for="k in kps"
            :key="k.id"
            @click="selectedKp.includes(k.id) ? selectedKp.splice(selectedKp.indexOf(k.id), 1) : selectedKp.push(k.id)"
            :class="selectedKp.includes(k.id) ? 'bg-danger text-white border-danger' : 'bg-white text-slate-600 border-slate-200'"
            class="px-2.5 py-1 rounded-full text-xs border"
          >{{ k.chapter }} / {{ k.topic }}</button>
        </div>
        <div class="flex gap-2 mt-2">
          <input v-model="newKp" class="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" placeholder="添加自定义知识点" />
          <button @click="addNewKp" class="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600">添加</button>
        </div>
      </div>

      <div>
        <label class="text-xs text-slate-500">错题照片（可选）</label>
        <div class="mt-1 flex items-center gap-3">
          <label class="text-xs px-3 py-2 rounded-lg bg-slate-100 text-slate-600 cursor-pointer">
            拍照/上传
            <input type="file" accept="image/*" capture="environment" class="hidden" @change="onFile" />
          </label>
          <img v-if="imagePreview" :src="imagePreview" class="w-16 h-16 object-cover rounded-lg border border-slate-200" />
          <button v-if="imageId" @click="imageId = null; imagePreview = null" class="text-xs text-slate-400">移除</button>
        </div>
      </div>

      <div>
        <label class="text-xs text-slate-500">我的错误答案</label>
        <textarea v-model="form.my_wrong_answer" rows="2" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"></textarea>
      </div>
      <div>
        <label class="text-xs text-slate-500">正确答案</label>
        <textarea v-model="form.correct_answer" rows="2" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"></textarea>
      </div>
      <div>
        <label class="text-xs text-slate-500">我的备注/复盘</label>
        <textarea v-model="form.my_note" rows="2" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"></textarea>
      </div>
    </div>

    <p v-if="msg" class="text-danger text-sm">{{ msg }}</p>
    <button @click="save" :disabled="saving" class="w-full bg-danger text-white text-sm font-semibold py-3 rounded-xl">
      {{ saving ? '保存中…' : '保存错题' }}
    </button>
  </div>
</template>
