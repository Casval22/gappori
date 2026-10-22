import { describe, expect, it } from 'vitest'
import { createInitialData } from '../domain/defaults'
import { appDataSchema } from '../domain/schema'
import { settle, undoLast } from '../domain/rounds'
import { matchesJob } from '../workers/protocol'
import { geta } from '../test/fixtures'
import { StorageRepository, parseBackup, MAX_BACKUP_BYTES } from './repository'
const memory = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}
describe('保存・復元の検証', () => {
  it('JSON往復とStorageRepositoryの名前空間', () => {
    const data = createInitialData(),
      storage = memory(),
      repo = new StorageRepository(storage, 'app-a')
    expect(repo.save(data)).toBeNull()
    expect(repo.load().data).toEqual(data)
    expect(new StorageRepository(storage, 'app-b').load().data).toBeNull()
    expect(parseBackup(JSON.stringify(data))).toEqual(data)
  })
  it('破損JSON・古い/未来バージョン・2MB超過を拒否する', () => {
    expect(() => parseBackup('{')).toThrow('JSON')
    expect(() => parseBackup(JSON.stringify({ ...createInitialData(), schemaVersion: 0 }))).toThrow(
      'バージョン',
    )
    expect(() => parseBackup(JSON.stringify({ ...createInitialData(), schemaVersion: 2 }))).toThrow(
      'バージョン',
    )
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow('2MB')
    const text = JSON.stringify(createInitialData()).replace('"balance":300', '"balance":1e999')
    expect(() => parseBackup(text)).toThrow()
  })
  it('破損データと空文字を説明なく上書きしない', () => {
    for (const raw of ['{broken', '']) {
      const storage = memory()
      storage.setItem('key', raw)
      const repo = new StorageRepository(storage, 'key')
      expect(repo.load().warning).toContain('保護')
      expect(repo.save(createInitialData())).toContain('保護')
      expect(storage.getItem('key')).toBe(raw)
      expect(repo.replace(createInitialData())).toBeNull()
    }
  })
  it('保存不可・容量超過でも例外で利用を止めない', () => {
    const repo = new StorageRepository({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
      removeItem: () => {},
    })
    expect(repo.load().data).toBeNull()
    expect(repo.save(createInitialData())).toContain('容量超過')
  })
  it('不正な型・重複型・同数列と順序を検証する', () => {
    const data = createInitialData()
    for (const counts of [
      [1, 2, 3],
      [0, 2, 3, 4, 6],
      [1, 1, 1, 1, 1, 1, 1, 1, 7],
      [1.5, 1.5, 3, 4, 5],
      [5, 4, 3, 2, 1],
    ])
      expect(
        appDataSchema.safeParse({ ...data, patterns: [{ ...data.patterns[0], counts }] }).success,
      ).toBe(false)
    expect(
      appDataSchema.safeParse({
        ...data,
        patterns: [...data.patterns, { ...data.patterns[0], id: 'duplicate' }],
      }).success,
    ).toBe(false)
    const restored = parseBackup(JSON.stringify(data))
    expect(restored.patterns[1].counts).toEqual([3, 3, 3, 3, 3])
  })
})
describe('精算と不変スナップショット', () => {
  it('二重精算を拒否し、設定編集が履歴に波及しない。取消は元の残高へ戻す', () => {
    const data = createInitialData(),
      before = structuredClone(data)
    const entries = [{ playerId: 'p1', actualCost: 5, payout: 20, extraCost: 3, extraPayout: 4 }]
    const result = settle(data, [[geta]], entries, 'hash')
    expect(data).toEqual(before)
    expect(result.players[0].balance).toBe(316)
    expect(() => settle(result, [[geta]], entries, 'hash')).toThrow('記録済み')
    result.rules.total = 18
    result.patterns[0].name = 'new'
    expect(result.history[0].rules.total).toBe(16)
    expect(result.history[0].pattern.name).toBe('階段')
    const restored = undoLast(result)
    expect(restored.players[0].balance).toBe(300)
    expect(restored.history).toHaveLength(0)
  })
  it('未入力払出・過大支出・参加者不一致を拒否', () => {
    const data = createInitialData(),
      entry = { playerId: 'p1', actualCost: 5, payout: 0, extraCost: 0, extraPayout: 0 }
    expect(() => settle(data, [[geta]], [{ ...entry, payout: NaN }], '')).toThrow()
    expect(() => settle(data, [[geta]], [{ ...entry, actualCost: 301 }], '')).toThrow()
    expect(() => settle(data, [[geta]], [{ ...entry, playerId: 'p2' }], '')).toThrow()
  })
  it('記録後に手動変更された残高を取消が無断上書きしない', () => {
    const result = settle(
      createInitialData(),
      [[geta]],
      [{ playerId: 'p1', actualCost: 5, payout: 0, extraCost: 0, extraPayout: 0 }],
      '',
    )
    result.players[0].balance = 100
    expect(() => undoLast(result)).toThrow('変更')
  })
  it('古いWorker結果はrequestId・roundId・全入力のいずれかが違えば破棄', () => {
    const job = { requestId: 'a', roundId: 'r', inputHash: 'h' }
    expect(matchesJob(job, job)).toBe(true)
    for (const key of ['requestId', 'roundId', 'inputHash'] as const)
      expect(matchesJob(job, { ...job, [key]: 'old' })).toBe(false)
  })
})
