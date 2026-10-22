import type { AppData, BetLine, Settlement } from './schema'
import { appDataSchema, settlementSchema } from './schema'
export function settle(
  data: AppData,
  lines: BetLine[][],
  entries: Settlement[],
  hash: string,
  now = new Date().toISOString(),
): AppData {
  if (data.history.some((h) => h.id === data.roundId)) throw new Error('このラウンドは記録済みです')
  if (data.history.length >= 200)
    throw new Error('履歴が200件に達しました。JSONを保存後、履歴を整理してください')
  const pattern = data.patterns.find((p) => p.id === data.selectedPatternId)
  if (!pattern) throw new Error('型を選択してください')
  const players = data.players.slice(0, data.playerCount)
  if (
    entries.length !== players.length ||
    lines.length !== players.length ||
    entries.some((e, i) => e.playerId !== players[i].id)
  )
    throw new Error('参加者と記録が一致しません')
  entries.forEach((e) => settlementSchema.parse(e))
  const before = players.map((p) => p.balance),
    after = entries.map((e, i) => before[i] - e.actualCost - e.extraCost + e.payout + e.extraPayout)
  if (
    entries.some((e, i) => e.actualCost + e.extraCost > before[i]) ||
    after.some((n) => n < 0 || n > 1_000_000_000)
  )
    throw new Error('支出が残高を超えています。または記録後残高が上限を超えます')
  const snapshot = structuredClone({
    id: data.roundId,
    number: data.roundNumber,
    recordedAt: now,
    pattern,
    rules: data.rules,
    players,
    bets: lines,
    quotes: data.quotes.filter((q) => q.roundId === data.roundId),
    inputHash: hash,
    entries,
    before,
    after,
  })
  return appDataSchema.parse({
    ...data,
    players: data.players.map((p, i) => (i < data.playerCount ? { ...p, balance: after[i] } : p)),
    history: [...data.history, snapshot],
  })
}
export function undoLast(data: AppData): AppData {
  const last = data.history.at(-1)
  if (!last) return data
  if (
    last.players.some(
      (p, i) => data.players.find((player) => player.id === p.id)?.balance !== last.after[i],
    )
  )
    throw new Error('記録後に残高が変更されています。取消前に残高を確認してください')
  return {
    ...data,
    players: data.players.map((p) => {
      const i = last.players.findIndex((player) => player.id === p.id)
      return i < 0 ? p : { ...p, balance: last.before[i] }
    }),
    history: data.history.slice(0, -1),
  }
}
