// Dexie 图片存储：错题拍照 Blob 存 IndexedDB，SQLite 只存 image_id
import Dexie from 'dexie'

export interface QuestionImage {
  id: string
  blob: Blob
  createdAt: number
}

class ImgDB extends Dexie {
  images!: Dexie.Table<QuestionImage, string>
  constructor() {
    super('exam-review-images')
    this.version(1).stores({
      images: 'id, createdAt'
    })
  }
}

const imgdb = new ImgDB()

/**
 * 压缩图片：宽度压到 1280px、转 WebP、质量 80%，目标 < 300KB
 */
export async function compressImage(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const maxW = 1280
  let { width, height } = bitmap
  if (width > maxW) {
    height = Math.round(height * (maxW / width))
    width = maxW
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas not supported')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('webp encode failed'))), 'image/webp', 0.8)
  })
  // 若仍超 300KB，用更低质量重压一次
  if (blob.size > 300 * 1024) {
    const b2 = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('webp encode failed'))), 'image/webp', 0.55)
    })
    return b2
  }
  return blob
}

export async function saveImage(id: string, blob: Blob): Promise<void> {
  await imgdb.images.put({ id, blob, createdAt: Date.now() })
}

export async function getImage(id: string): Promise<Blob | undefined> {
  const row = await imgdb.images.get(id)
  return row?.blob
}

export async function objectURL(id: string): Promise<string | null> {
  const blob = await getImage(id)
  return blob ? URL.createObjectURL(blob) : null
}

export async function deleteImage(id: string): Promise<void> {
  await imgdb.images.delete(id)
}
