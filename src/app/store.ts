import { create } from 'zustand'
import { appDataSchema, type AppData } from '../domain/schema'
import { createInitialData } from '../domain/defaults'
import { StorageRepository } from '../storage/repository'
let repository: StorageRepository
try {
  repository = new StorageRepository(window.localStorage)
} catch {
  repository = new StorageRepository({
    getItem() {
      throw new Error('保存不可')
    },
    setItem() {
      throw new Error('保存不可')
    },
    removeItem() {
      throw new Error('保存不可')
    },
  })
}
const loaded = repository.load()
interface State {
  data: AppData
  warning: string | null
  demo: boolean
  realData: AppData | null
  update: (transform: (data: AppData) => AppData) => void
  replace: (data: AppData) => void
  setDemo: (demo: boolean) => void
}
export const useApp = create<State>((set) => ({
  data: loaded.data ?? createInitialData(),
  warning: loaded.warning,
  demo: false,
  realData: null,
  update: (transform) => set((s) => ({ data: appDataSchema.parse(transform(s.data)) })),
  replace: (data) => {
    clearTimeout(timer)
    const parsed = appDataSchema.parse(data)
    const warning = repository.replace(parsed)
    set({ data: parsed, warning, demo: false, realData: null })
  },
  setDemo: (demo) =>
    set((s) =>
      demo === s.demo
        ? s
        : demo
          ? { demo: true, realData: s.data, data: structuredClone(s.data) }
          : { demo: false, data: s.realData ?? s.data, realData: null },
    ),
}))
let timer: ReturnType<typeof setTimeout>
export function flushSave() {
  clearTimeout(timer)
  const warning = repository.save(useApp.getState().realData ?? useApp.getState().data)
  if (warning !== useApp.getState().warning) useApp.setState({ warning })
}
useApp.subscribe((state, previous) => {
  if (!state.demo && state.data !== previous.data) {
    clearTimeout(timer)
    timer = setTimeout(flushSave, 400)
  }
})
window.addEventListener('pagehide', flushSave)
window.addEventListener('storage', (e) => {
  if (e.key === null || e.key === `gappori-navi:${import.meta.env.BASE_URL}:v1`) {
    clearTimeout(timer)
    repository.protected = true
    useApp.setState({
      warning:
        '別タブで保存データが変更されました。競合を防ぐため保存を停止しました。必要ならJSONを保存し、再読み込みしてください。',
    })
  }
})
export const getRawBackup = () => repository.raw()
