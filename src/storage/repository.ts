import { appDataSchema, type AppData } from '../domain/schema'
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024
export const STORAGE_KEY = `gappori-navi:${import.meta.env.BASE_URL}:v1`
export function parseBackup(text: string): AppData {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error('JSONは2MB以下にしてください')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('JSONとして読み取れません')
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 1
  )
    throw new Error('未対応の保存バージョンです。元データは変更していません')
  const result = appDataSchema.safeParse(value)
  if (!result.success) throw new Error(`データが不正です：${result.error.issues[0]?.message}`)
  if (
    result.data.quotes.some((q) => q.source === 'demo') ||
    result.data.history.some((h) => h.quotes.some((q) => q.source === 'demo'))
  )
    throw new Error('デモ配当は実データに復元できません')
  return result.data
}
export class StorageRepository {
  protected = false
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
    private readonly key = STORAGE_KEY,
  ) {}
  load(): { data: AppData | null; warning: string | null } {
    try {
      const raw = this.storage.getItem(this.key)
      return { data: raw !== null ? parseBackup(raw) : null, warning: null }
    } catch (error) {
      this.protected = true
      return {
        data: null,
        warning: `保存データを読み込めません。元データを保護し、一時利用しています。${error instanceof Error ? error.message : ''}`,
      }
    }
  }
  save(data: AppData): string | null {
    if (this.protected)
      return '元データを保護中です。データ管理で元JSONを退避後、復元または初期化してください。'
    try {
      const serialized = JSON.stringify(appDataSchema.parse(data))
      if (new TextEncoder().encode(serialized).length > MAX_BACKUP_BYTES)
        throw new Error('保存上限2MBを超えました')
      this.storage.setItem(this.key, serialized)
      return null
    } catch {
      return '端末に保存できません（容量超過・保存制限）。一時利用は継続できます。JSONをバックアップしてください。'
    }
  }
  raw() {
    try {
      return this.storage.getItem(this.key)
    } catch {
      return null
    }
  }
  replace(data: AppData) {
    this.protected = false
    return this.save(data)
  }
}
