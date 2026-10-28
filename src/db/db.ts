// SQLite WASM（内存库）+ IndexedDB 整库快照持久化
// 说明：当前环境（浏览器 webview/iframe）下 sqlite-wasm 的 OPFS / KVvfs VFS 持久化不稳定
// （OPFS proxy 加载随机失败卡顿；KVvfs 在 worker 线程内无 localStorage API 无法真正落盘）。
// 故采用「内存 SQLite + 每次写入后把整库 dump 快照到 IndexedDB」，刷新/关闭浏览器不丢失数据。
import { sqlite3Worker1Promiser } from '@sqlite.org/sqlite-wasm'
import { SCHEMA_SQL, PRESET_SQL, PRESET_MORE_KP_SQL } from './schema'

export type Row = Record<string, any>
export type Bind = Record<string, string | number | null> | (string | number | null)[]

interface Promiser {
  (command: string, payload: Record<string, any>): Promise<{ result: any; error?: any }>
}

let promiser: Promiser | null = null
let dbHandle: any = null
let persistent = false
let backend = 'memory'
let persistError = ''
let counts: Record<string, number> = { subject: -1, exam: -1, question: -1 }
let initPromise: Promise<boolean> | null = null

const IDB_NAME = 'exam-review-db'
const IDB_STORE = 'kv'
const IDB_KEY = 'dump'

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error || new Error('IndexedDB open failed'))
  })
}

async function idbLoad(): Promise<string | null> {
  try {
    const db = await idbOpen()
    return await new Promise((res) => {
      const g = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY)
      g.onsuccess = () => { const v = g.result; res(typeof v === 'string' ? v : null) }
      g.onerror = () => res(null)
    })
  } catch {
    return null
  }
}

async function idbSave(value: string): Promise<boolean> {
  try {
    const db = await idbOpen()
    return await new Promise((res) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, IDB_KEY)
      tx.oncomplete = () => res(true)
      tx.onerror = () => res(false)
    })
  } catch {
    return false
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await idbOpen()
    await new Promise<void>((res) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).clear()
      tx.oncomplete = () => res()
      tx.onerror = () => res()
    })
  } catch {
    /* ignore */
  }
}

export function isPersistent(): boolean {
  return persistent
}

export function getPersistInfo(): { persistent: boolean; backend: string; error: string; counts: Record<string, number> } {
  return { persistent, backend, error: persistError, counts }
}

export function isReady(): boolean {
  return promiser !== null
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

/** 写入后防抖地把整库快照保存到 IndexedDB */
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(async () => {
    try {
      const dump = await exportDump()
      const ok = await idbSave(dump)
      if (ok) {
        persistent = true
        backend = 'indexeddb'
      }
    } catch (e) {
      persistError = 'persist ' + (e instanceof Error ? e.message : String(e))
    }
  }, 300)
}

export function initDB(force = false): Promise<boolean> {
  if (initPromise && !force) return initPromise
  initPromise = (async () => {
    try {
      promiser = (await sqlite3Worker1Promiser()) as Promiser
      dbHandle = await promiser('open', { filename: 'file:exam.db' })
      persistent = false
      backend = 'memory'

      try {
        await promiser('exec', { sql: SCHEMA_SQL })
      } catch (e) {
        persistError = 'schema ' + (e instanceof Error ? e.message : JSON.stringify(e))
      }

      // 优先从 IndexedDB 恢复上次快照；首次才走预置
      let restored = false
      const dump = await idbLoad()
      if (dump && dump.trim()) {
        try {
          await promiser('exec', {
            sql: 'DELETE FROM review_log; DELETE FROM question_kp; DELETE FROM action_item; DELETE FROM question; DELETE FROM subject_score; DELETE FROM exam_meta; DELETE FROM exam; DELETE FROM knowledge_point; DELETE FROM subject;'
          })
          await promiser('exec', { sql: dump })
          restored = true
        } catch (e) {
          persistError += ' / restore ' + (e instanceof Error ? e.message : JSON.stringify(e))
        }
      }
      if (!restored) {
        for (const [name, sql] of [['preset', PRESET_SQL], ['preset_more', PRESET_MORE_KP_SQL]] as Array<[string, string]>) {
          try {
            await promiser('exec', { sql })
          } catch (e) {
            persistError += ` / init:${name} ` + (e instanceof Error ? e.message : JSON.stringify(e))
          }
        }
      }

      try {
        const chk = await promiser('exec', {
          sql: 'SELECT (SELECT COUNT(*) FROM subject) s, (SELECT COUNT(*) FROM exam) e, (SELECT COUNT(*) FROM question) q',
          rowMode: 'object'
        })
        const row = chk.result?.resultRows?.[0]
        counts = { subject: Number(row?.s ?? -1), exam: Number(row?.e ?? -1), question: Number(row?.q ?? -1) }
      } catch (e) {
        persistError += ' / count ' + (e instanceof Error ? e.message : JSON.stringify(e))
      }

      schedulePersist()
      return true
    } catch (e) {
      console.error('数据库初始化失败', e)
      promiser = null
      initPromise = null
      return false
    }
  })()
  return initPromise
}

async function getPromiser(): Promise<Promiser> {
  if (!promiser) {
    const ok = await initDB()
    if (!ok) throw new Error('数据库未初始化')
  }
  return promiser!
}

export async function all<T = Row>(sql: string, bind?: Bind): Promise<T[]> {
  const p = await getPromiser()
  const res = await p('exec', { sql, bind: bind as any, rowMode: 'object' })
  return (res.result?.resultRows as T[]) ?? []
}

export async function get<T = Row>(sql: string, bind?: Bind): Promise<T | undefined> {
  const rows = await all<T>(sql, bind)
  return rows[0]
}

export async function run(sql: string, bind?: Bind): Promise<{ lastInsertRowid: number; changes: number }> {
  const p = await getPromiser()
  const res = await p('exec', { sql, bind: bind as any, rowMode: 'object' })
  let lastInsertRowid = 0
  if (/^\s*insert/i.test(sql)) {
    const r2 = await p('exec', { sql: 'SELECT last_insert_rowid() AS id', rowMode: 'object' })
    const row = (r2.result?.resultRows?.[0] ?? {}) as any
    lastInsertRowid = row ? Number(row.id) : 0
  }
  schedulePersist()
  return {
    lastInsertRowid,
    changes: Number(res.result?.changes ?? 0)
  }
}

/** 多个语句按序执行（用于预置/迁移），各自独立 bind */
export async function batch(sql: string): Promise<void> {
  const p = await getPromiser()
  await p('exec', { sql })
  schedulePersist()
}

/** 诊断用：执行任意单条 SQL 并返回结果或完整错误 */
export async function debugSQL(sql: string): Promise<{ ok: boolean; err?: string; rows?: unknown }> {
  const p = await getPromiser()
  try {
    const res = await p('exec', { sql, rowMode: 'object' })
    return { ok: true, rows: res.result?.resultRows }
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message : JSON.stringify(e) }
  }
}

/** 重新打开数据库（设置页「重建」用）：清空快照并重建 */
export async function resetDB(): Promise<void> {
  if (dbHandle) {
    try {
      await promiser?.('close', {})
    } catch {
      /* ignore */
    }
  }
  await idbClear()
  promiser = null
  dbHandle = null
  initPromise = null
  persistent = false
  backend = 'memory'
  await initDB()
}

/** 导出整库为 SQL dump（备份 + IndexedDB 快照共用） */
export async function exportDump(): Promise<string> {
  const p = await getPromiser()
  const tables = ((await p('exec', {
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    rowMode: 'object'
  })).result?.resultRows ?? []) as Array<{ name: string }>
  let out = ''
  for (const t of tables) {
    const tn = t.name
    const cols = ((await p('exec', { sql: `PRAGMA table_info("${tn}")`, rowMode: 'object' })).result?.resultRows ?? []) as Array<{ name: string }>
    const colNames = cols.map((c) => c.name)
    const rows = ((await p('exec', { sql: `SELECT * FROM "${tn}"`, rowMode: 'object' })).result?.resultRows ?? []) as Array<Record<string, any>>
    for (const r of rows) {
      const vals = colNames.map((c) => {
        const v = r[c]
        if (v === null || v === undefined) return 'NULL'
        if (typeof v === 'number') return String(v)
        return `'${String(v).replace(/'/g, "''")}'`
      })
      out += `INSERT INTO "${tn}"(${colNames.map((c) => `"${c}"`).join(',')}) VALUES(${vals.join(',')});\n`
    }
  }
  return out
}

/** 导出整库为 SQLite 数据库文件（.db，供备份/拷走/用 SQLite 工具打开） */
export async function exportDbFile(): Promise<Uint8Array> {
  const p = await getPromiser()
  const res = await p('export', {})
  const ba = res?.result?.byteArray
  if (!ba) throw new Error('导出数据库文件失败：未取到库文件数据')
  return ba as Uint8Array
}

/** 从 SQL dump 恢复（导入），先清空现有表 */
export async function importDump(dump: string): Promise<void> {
  const p = await getPromiser()
  await p('exec', {
    sql: 'DELETE FROM review_log; DELETE FROM question_kp; DELETE FROM action_item; DELETE FROM question; DELETE FROM subject_score; DELETE FROM exam_meta; DELETE FROM exam; DELETE FROM knowledge_point; DELETE FROM subject;'
  })
  await p('exec', { sql: dump })
  schedulePersist()
}
