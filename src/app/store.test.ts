import { afterEach, describe, expect, it, vi } from 'vitest'
import { useApp, flushSave } from './store'
import { createInitialData } from '../domain/defaults'
import { STORAGE_KEY, parseBackup } from '../storage/repository'
afterEach(() => {
  vi.useRealTimers()
  useApp.getState().replace(createInitialData())
})
describe('端末状態・デモの分離', () => {
  it('人数を減らしても4人分の条件を残す', () => {
    const store = useApp.getState()
    store.replace(createInitialData())
    store.update((d) => ({
      ...d,
      playerCount: 4,
      players: d.players.map((p, i) => (i === 3 ? { ...p, balance: 777 } : p)),
    }))
    store.update((d) => ({ ...d, playerCount: 1 }))
    store.update((d) => ({ ...d, playerCount: 4 }))
    expect(useApp.getState().data.players[3].balance).toBe(777)
  })
  it('デモ中の編集は保存しない。終了時は実データに戻す', () => {
    const data = createInitialData(),
      store = useApp.getState()
    store.replace(data)
    store.setDemo(true)
    store.update((d) => ({
      ...d,
      rules: { ...d.rules, getaCost: 999 },
      players: d.players.map((p) => ({ ...p, balance: 1 })),
    }))
    flushSave()
    expect(parseBackup(localStorage.getItem(STORAGE_KEY)!).rules.getaCost).toBe(5)
    expect(parseBackup(localStorage.getItem(STORAGE_KEY)!).players[0].balance).toBe(300)
    store.setDemo(false)
    expect(useApp.getState().data).toEqual(data)
  })
  it('400msでまとめて保存する', () => {
    vi.useFakeTimers()
    const store = useApp.getState()
    store.replace(createInitialData())
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    store.update((d) => ({ ...d, playerCount: 2 }))
    store.update((d) => ({ ...d, playerCount: 3 }))
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(401)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(parseBackup(localStorage.getItem(STORAGE_KEY)!).playerCount).toBe(3)
    spy.mockRestore()
  })
})
