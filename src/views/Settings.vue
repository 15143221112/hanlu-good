<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPersistInfo, exportDump, exportDbFile, importDump, resetDB, initDB } from '../db/db'
import { bump } from '../store/bus'

const student = ref({ name: '', school: '', grade: '', classNo: '' })
const info = ref<{ persistent: boolean; backend: string; error: string; counts: Record<string, number> }>({ persistent: false, backend: 'memory', error: '', counts: { subject: -1, exam: -1, question: -1 } })
const ready = ref(false)
const msg = ref('')
const impMsg = ref('')

function loadStudent() {
  try {
    const raw = localStorage.getItem('exam-review-student')
    if (raw) student.value = { ...student.value, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
}
function saveStudent() {
  localStorage.setItem('exam-review-student', JSON.stringify(student.value))
  msg.value = '学生信息已保存'
}
async function init() {
  ready.value = await initDB()
  info.value = getPersistInfo()
  // 首次快照在 schedulePersist（防抖 300ms）后才落盘，延迟重读以正确显示持久化状态
  setTimeout(() => { info.value = getPersistInfo() }, 1600)
  loadStudent()
}
onMounted(init)

async function doExport() {
  const dump = await exportDump()
  const blob = new Blob([dump], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `考后复盘备份_${new Date().toISOString().slice(0, 10)}.sql`
  a.click()
  URL.revokeObjectURL(url)
  msg.value = 'SQL 备份已导出（.sql，可用导入恢复）'
}

async function doExportDb() {
  const ba = await exportDbFile()
  const blob = new Blob([ba as BlobPart], { type: 'application/x-sqlite3' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `考后复盘数据库_${new Date().toISOString().slice(0, 10)}.db`
  a.click()
  URL.revokeObjectURL(url)
  msg.value = '数据库文件已导出（.db，可拷走备份/用 SQLite 工具打开）'
}

async function doImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    await importDump(text)
    bump()
    impMsg.value = '导入成功'
  } catch (err) {
    impMsg.value = '导入失败：' + (err as Error).message
  } finally {
    input.value = ''
  }
}

async function doReset() {
  if (!confirm('确定清空所有数据并重建数据库吗？建议先导出备份。')) return
  await resetDB()
  info.value = getPersistInfo()
  bump()
  impMsg.value = '已重建数据库'
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-sm font-bold text-slate-700">我的 / 设置</h2>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
      <h3 class="text-xs font-bold text-slate-600">学生信息</h3>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-slate-500">姓名</label>
          <input v-model="student.name" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="李函璐" />
        </div>
        <div>
          <label class="text-xs text-slate-500">学校</label>
          <input v-model="student.school" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="text-xs text-slate-500">年级</label>
          <input v-model="student.grade" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="text-xs text-slate-500">班级</label>
          <input v-model="student.classNo" class="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <button @click="saveStudent" class="w-full bg-danger text-white text-sm font-semibold py-2.5 rounded-lg">保存信息</button>
      <p v-if="msg" class="text-success text-xs">{{ msg }}</p>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-2">
      <h3 class="text-xs font-bold text-slate-600">数据存储</h3>
      <div class="text-sm flex items-center gap-2">
        <span class="w-2 h-2 rounded-full" :class="info.persistent ? 'bg-success' : 'bg-warning'"></span>
        {{ info.persistent ? '数据已持久化到本机，关闭/刷新不丢失' : '数据暂存于内存，等待持久化…' }}
      </div>
      <p class="text-[11px] text-slate-500">数据存储于本地 <b>SQLite 数据库表</b>（subject / exam / subject_score / question / knowledge_point / action_item 等 9 张表），全部结构化落表。</p>
      <p v-if="info.error" class="text-[11px] text-warning">诊断：{{ info.error }}</p>
      <p class="text-[11px] text-slate-400">当前表数据：学科 {{ info.counts.subject }} · 考试 {{ info.counts.exam }} · 错题 {{ info.counts.question }}</p>
      <p class="text-[11px] text-slate-400">本机浏览器内自动持久化；如需换电脑，请用下方「导出数据库文件(.db)」把整库带走，在新电脑「导入」。</p>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-2">
      <h3 class="text-xs font-bold text-slate-600">数据备份 / 换机迁移</h3>
      <button @click="doExportDb" class="w-full bg-white border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-lg">导出数据库文件（.db，整库带走/拷走备份）</button>
      <button @click="doExport" class="w-full bg-white border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-lg">导出 SQL 备份（.sql，可用导入恢复）</button>
      <label class="block w-full text-center bg-white border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-lg cursor-pointer">
        导入备份（.sql）
        <input type="file" accept=".sql,text/plain" class="hidden" @change="doImport" />
      </label>
      <p v-if="impMsg" class="text-success text-xs">{{ impMsg }}</p>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <h3 class="text-xs font-bold text-slate-600 text-danger">危险操作</h3>
      <button @click="doReset" class="mt-2 w-full bg-danger/5 border border-danger text-danger text-sm font-medium py-2.5 rounded-lg">清空数据并重建</button>
    </div>
  </div>
</template>
