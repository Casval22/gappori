import { useState } from 'react'
import type { BetLine } from '../../domain/schema'
import type { CalculationInput } from '../../engine/types'
import { chooseFc, fcRate } from '../../engine/freeChoice'
import { fulfilled, outcomes } from '../../engine/outcomes'
import { columnLabel, requirementLabel } from '../../domain/keys'
import { NumberField } from '../../components/Fields'
import { percent } from '../../domain/format'
export function FreeChoicePanel({ input, lines }: { input: CalculationInput; lines: BetLine[] }) {
  const [index, setIndex] = useState(0),
    [first, setFirst] = useState([...input.pattern.counts, input.rules.special].map(() => 0)),
    [acquired, setAcquired] = useState(true)
  const h = [...input.pattern.counts, input.rules.special],
    line = lines[index]
  const valid =
    first.reduce((a, b) => a + b, 0) === 3 &&
    first.every((n, i) => Number.isInteger(n) && n >= 0 && n <= h[i])
  const choice =
    valid && line && line.kind !== 'round'
      ? chooseFc(h, line.requirement, first, input.rules)
      : null
  const base =
    valid && line
      ? outcomes(
          h.map((n, i) => n - first[i]),
          2,
        ).reduce(
          (p, o) =>
            p +
            (fulfilled(
              o.counts.map((n, i) => n + first[i]),
              line.requirement,
            )
              ? o.probability
              : 0),
          0,
        )
      : 0
  const rate = line ? fcRate(line, input.rules) : null
  return (
    <details className="panel">
      <summary>前半3球からFC対象を確認</summary>
      <p className="muted">前半で入った個数を入力します。後半の結果は使いません。</p>
      <label className="field">
        対象BET
        <select value={index} onChange={(e) => setIndex(Number(e.target.value))}>
          {lines.map((b, i) => (
            <option key={i} value={i}>
              {requirementLabel(b.requirement)}
            </option>
          ))}
        </select>
      </label>
      <div className="requirements">
        {h.map((n, i) => (
          <NumberField
            key={i}
            label={i === h.length - 1 ? '特殊' : columnLabel(i)}
            min={0}
            max={n}
            value={first[i]}
            onChange={(v) => setFirst(first.map((x, j) => (j === i ? (v ?? NaN) : x)))}
          />
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={acquired} onChange={(e) => setAcquired(e.target.checked)} />{' '}
        この行のFCを獲得済み
      </label>
      {choice ? (
        <p className="notice">
          推奨：{choice.column === null ? '選択可能な列なし' : columnLabel(choice.column)} ·{' '}
          {acquired ? 'FC獲得済み条件' : rate === null ? 'FC不明のため除外' : 'FC獲得率込み'}
          の成立確率{' '}
          <strong>
            {percent(
              acquired ? choice.probability : base + (rate ?? 0) * (choice.probability - base),
            )}
          </strong>
        </p>
      ) : (
        <p>通常列と特殊枠を合わせて前半3球を入力してください。丸皿はFC対象外です。</p>
      )}
    </details>
  )
}
