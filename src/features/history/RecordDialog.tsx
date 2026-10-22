import { useState } from 'react'
import { useApp } from '../../app/store'
import { Dialog } from '../../components/Dialog'
import { NumberField } from '../../components/Fields'
import { settle } from '../../domain/rounds'
import type { BetLine } from '../../domain/schema'
import { costOf } from '../../domain/keys'
export function RecordDialog({
  lines,
  hash,
  onClose,
}: {
  lines: BetLine[][]
  hash: string
  onClose: () => void
}) {
  const { data, update } = useApp(),
    [error, setError] = useState('')
  const [entries, setEntries] = useState(
    data.players.slice(0, data.playerCount).map((p, i) => ({
      playerId: p.id,
      actualCost: costOf(lines[i]),
      payout: NaN,
      extraCost: 0,
      extraPayout: 0,
    })),
  )
  const set = (
    i: number,
    key: 'actualCost' | 'payout' | 'extraCost' | 'extraPayout',
    value: number | null,
  ) => setEntries(entries.map((e, j) => (i === j ? { ...e, [key]: value ?? NaN } : e)))
  return (
    <Dialog title={`ラウンド ${data.roundNumber} の結果を記録`} onClose={onClose}>
      <p className="notice">
        実際の枚数を確認してください。払出は未入力のまま0扱いにしません。記録すると残高へ1回だけ反映します。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!window.confirm('実際の結果を記録し、残高に反映しますか？')) return
          try {
            update((d) => settle(d, lines, entries, hash))
            onClose()
          } catch (err) {
            setError(err instanceof Error ? err.message : '記録に失敗しました')
          }
        }}
      >
        {entries.map((e, i) => (
          <fieldset key={e.playerId}>
            <legend>
              {data.players[i].name} · 残高 {data.players[i].balance}枚
            </legend>
            <div className="form-grid">
              <NumberField
                label={`${data.players[i].name} 実際のBET費用`}
                value={e.actualCost}
                onChange={(v) => set(i, 'actualCost', v)}
              />
              <NumberField
                label={`${data.players[i].name} 通常払出`}
                value={e.payout}
                onChange={(v) => set(i, 'payout', v)}
              />
              <NumberField
                label={`${data.players[i].name} 追加支出`}
                value={e.extraCost}
                onChange={(v) => set(i, 'extraCost', v)}
              />
              <NumberField
                label={`${data.players[i].name} 追加獲得`}
                value={e.extraPayout}
                onChange={(v) => set(i, 'extraPayout', v)}
              />
            </div>
            <p>
              記録後：
              {Number.isFinite(e.payout)
                ? data.players[i].balance - e.actualCost - e.extraCost + e.payout + e.extraPayout
                : '未入力'}
              枚
            </p>
          </fieldset>
        ))}
        <p className="caption">
          BET構成は計算時のスナップショットです。実機で変更した費用は上の実費欄で記録してください。
        </p>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <button className="primary full" type="submit">
          確認して残高に反映
        </button>
      </form>
    </Dialog>
  )
}
