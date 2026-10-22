import { useState } from 'react'
import { useApp } from '../../app/store'
import { NumberField } from '../../components/Fields'
import { StackedPattern } from '../../components/StackedPattern'
import {
  columnLabel,
  compatible,
  patternKey,
  requirementLabel,
  ruleKey,
  kindLabel,
} from '../../domain/keys'
import { uid } from '../../domain/defaults'
import { betSchema, quoteSchema, type BetLine, type PayoutQuote } from '../../domain/schema'
export function BetRegistration({
  initialLine,
  onSaved,
}: {
  initialLine?: BetLine
  onSaved?: () => void
}) {
  const { data, update } = useApp(),
    pattern = data.patterns.find((p) => p.id === data.selectedPatternId)
  const [kind, setKind] = useState<BetLine['kind']>(initialLine?.kind ?? 'geta')
  const [requirement, setRequirement] = useState(
    initialLine?.requirement ?? pattern?.counts.map(() => 0) ?? [],
  )
  const [quantity, setQuantity] = useState(initialLine?.quantity ?? data.rules.quantityStep),
    [gross, setGross] = useState<number | null>(null)
  const [scope, setScope] = useState<PayoutQuote['scope']>('quantity'),
    [unitCost, setUnitCost] = useState(initialLine?.unitCost ?? 5),
    [message, setMessage] = useState('')
  if (!pattern || !compatible(pattern, data.rules))
    return (
      <section className="panel">
        <h2>配当・丸皿の登録</h2>
        <p>プレイ画面で有効な型を選択してください。</p>
      </section>
    )
  const cost =
    kind === 'geta' ? data.rules.getaCost : kind === 'boat' ? data.rules.boatCost : unitCost
  const line: BetLine = { kind, requirement, quantity, unitCost: cost }
  const quote: PayoutQuote = {
    id: 'pending',
    patternKey: patternKey(pattern),
    ruleKey: ruleKey(data.rules),
    kind,
    requirement,
    quantity,
    source: 'manual',
    scope,
    gross: gross ?? NaN,
    roundId: data.roundId,
  }
  const valid =
    betSchema.safeParse(line).success &&
    quoteSchema.safeParse(quote).success &&
    requirement.length === pattern.counts.length &&
    quantity <= data.rules.maxQuantity &&
    quantity % data.rules.quantityStep === 0
  return (
    <section className="panel">
      <h2>配当・丸皿の登録</h2>
      <p className="muted">
        ラウンド {data.roundNumber} · {pattern.name || '選択中の型'}
        。実機で確認した「当選時の総払出」を入力します。
      </p>
      <StackedPattern counts={pattern.counts} highlight={requirement} compact />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          const previous = data.quotes.find(
            (q) =>
              q.patternKey === quote.patternKey &&
              q.ruleKey === quote.ruleKey &&
              q.roundId === quote.roundId &&
              q.kind === kind &&
              q.requirement.join(',') === requirement.join(',') &&
              q.scope === scope &&
              (scope === 'perPlate' || q.quantity === quantity),
          )
          if (previous && !window.confirm('この条件の配当を上書きしますか？')) return
          try {
            update((d) => ({
              ...d,
              quotes: [
                ...d.quotes.filter((q) => q.id !== previous?.id),
                { ...quote, id: previous?.id ?? uid() },
              ],
              manualBets:
                kind === 'round'
                  ? [
                      ...d.manualBets.filter(
                        (b) =>
                          !(
                            b.patternKey === quote.patternKey &&
                            b.ruleKey === quote.ruleKey &&
                            b.roundId === quote.roundId &&
                            b.line.requirement.join(',') === requirement.join(',')
                          ),
                      ),
                      {
                        id: uid(),
                        patternKey: quote.patternKey,
                        ruleKey: quote.ruleKey,
                        roundId: quote.roundId,
                        line,
                      },
                    ]
                  : d.manualBets,
            }))
            setMessage('今回確認した配当を保存しました')
            onSaved?.()
          } catch {
            setMessage('保存上限に達しています。データ管理で登録済み配当を整理してください。')
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            皿種
            <select value={kind} onChange={(e) => setKind(e.target.value as BetLine['kind'])}>
              <option value="geta">下駄（3貫）</option>
              <option value="boat">舟（5貫）</option>
              <option value="round">実機で確認した丸皿（1〜2貫）</option>
            </select>
          </label>
          <NumberField
            label="購入皿数"
            min={1}
            max={data.rules.maxQuantity}
            step={data.rules.quantityStep}
            value={quantity}
            onChange={(v) => setQuantity(v ?? NaN)}
          />
          {kind === 'round' && (
            <NumberField
              label="丸皿1皿の費用"
              min={1}
              max={10000}
              value={unitCost}
              onChange={(v) => setUnitCost(v ?? NaN)}
            />
          )}
        </div>
        <div className="requirements">
          {pattern.counts.map((_, i) => (
            <NumberField
              key={i}
              label={`${columnLabel(i)}の要求`}
              min={0}
              max={5}
              value={requirement[i] ?? 0}
              onChange={(v) =>
                setRequirement(
                  pattern.counts.map((_, j) => (j === i ? (v ?? NaN) : (requirement[j] ?? 0))),
                )
              }
            />
          ))}
        </div>
        <p>
          合計要求：{requirement.reduce((a, b) => a + b, 0)}貫 · 費用 {cost * quantity}枚
        </p>
        <label className="field">
          数量の適用範囲
          <select value={scope} onChange={(e) => setScope(e.target.value as PayoutQuote['scope'])}>
            <option value="quantity">指定した購入数量の合計表示値</option>
            <option value="perPlate">1皿あたり・数量比例を確認済み</option>
          </select>
        </label>
        <NumberField
          label={scope === 'quantity' ? '指定数量の総払出枚数' : '1皿あたりの総払出枚数'}
          value={gross}
          onChange={setGross}
        />
        <button type="submit" className="primary full" disabled={!valid}>
          今回確認した配当を保存
        </button>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </form>
      {!initialLine && (
        <details>
          <summary>登録済みの配当（{data.quotes.length}件）</summary>
          {data.quotes.map((q) => (
            <div className="quote-row" key={q.id}>
              <span>
                {kindLabel(q.kind)}：{requirementLabel(q.requirement)} ／ {q.gross}枚 ·{' '}
                {q.scope === 'perPlate' ? '1皿' : `${q.quantity}皿合計`}
                <small>
                  {q.roundId === data.roundId &&
                  q.ruleKey === ruleKey(data.rules) &&
                  q.patternKey === patternKey(pattern)
                    ? '今回確認済み'
                    : '今回未確認 / 別の条件'}
                </small>
              </span>
              <button
                onClick={() => {
                  if (window.confirm('この配当を削除しますか？'))
                    update((d) => ({ ...d, quotes: d.quotes.filter((v) => v.id !== q.id) }))
                }}
              >
                削除
              </button>
            </div>
          ))}
        </details>
      )}
    </section>
  )
}
