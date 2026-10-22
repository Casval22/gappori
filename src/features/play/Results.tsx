import { useState } from 'react'
import { useApp } from '../../app/store'
import { StackedPattern } from '../../components/StackedPattern'
import { Dialog } from '../../components/Dialog'
import { number, percent } from '../../domain/format'
import { columnLabel, kindLabel, requirementLabel } from '../../domain/keys'
import { uid } from '../../domain/defaults'
import type { BetLine } from '../../domain/schema'
import type { CalculationInput, CalculationResult, MoneyMetrics } from '../../engine/types'
import { BetRegistration } from '../settings/BetRegistration'
import { RecordDialog } from '../history/RecordDialog'
import { FreeChoicePanel } from './FreeChoicePanel'
import { SimulationPanel } from './SimulationPanel'
function Money({ value }: { value: MoneyMetrics | null }) {
  if (!value) return <p className="caption">配当不明 · 収支は計算しません</p>
  return (
    <div className="money">
      <dl className="stats">
        <div>
          <dt>期待払出</dt>
          <dd>{number(value.expectedGross)}枚</dd>
        </div>
        <div>
          <dt>期待純増</dt>
          <dd>{number(value.expectedNet)}枚</dd>
        </div>
        <div>
          <dt>純増が正</dt>
          <dd>{percent(value.profitProbability)}</dd>
        </div>
        <div>
          <dt>損失確率</dt>
          <dd>{percent(value.lossProbability)}</dd>
        </div>
      </dl>
      <details>
        <summary>収支分布と大当たり</summary>
        <p>設定した純増閾値以上：{percent(value.jackpotProbability)}</p>
        <div className="distribution" role="table" aria-label="純増の確率分布">
          {value.distribution.map((d) => (
            <div className="distribution-row" role="row" key={d.net}>
              <span role="cell">{number(d.net)}枚</span>
              <progress max={1} value={d.probability} aria-label={`純増${d.net}枚`} />
              <span role="cell">{percent(d.probability)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
export function Results({ result, input }: { result: CalculationResult; input: CalculationInput }) {
  const { data, update } = useApp(),
    [index, setIndex] = useState(0),
    [quote, setQuote] = useState<BetLine | null>(null),
    [record, setRecord] = useState(false)
  const selected = result.groups[index] ?? result.groups[0],
    recorded = data.history.some((h) => h.id === data.roundId)
  if (!selected) return <p>購入可能な案なし</p>
  const evaluation = selected.evaluation,
    known = evaluation.money.every(Boolean)
  return (
    <div className="page-stack">
      <section aria-label="BET候補">
        <div className="section-heading">
          <div>
            <span className="eyebrow">02 · YOUR BET</span>
            <h2>探索範囲内のおすすめ</h2>
          </div>
          <span className="badge">
            {input.demo ? '架空配当のデモ' : known ? '配当入力済み候補内' : '確率ベース'}
          </span>
        </div>
        <div className="plan-tabs">
          {result.groups.map((g, i) => (
            <button key={i} aria-pressed={i === index} onClick={() => setIndex(i)}>
              <strong>{i === 0 ? 'おすすめ' : `候補 ${i + 1}`}</strong>
              <span>誰か成立 {percent(g.evaluation.any)}</span>
            </button>
          ))}
        </div>
        <div className="player-results">
          {selected.plans.map((p, i) => (
            <article className="bet-card" key={input.players[i].id}>
              <div className="section-heading">
                <h3>
                  <span className="avatar">{i + 1}</span> {input.players[i].name}
                </h3>
                <span className="badge">{index === 0 ? '採用案' : `候補 ${index + 1}`}</span>
              </div>
              {!p.lines.length ? (
                <p className="notice">購入可能な案なし。残高・上限・操作時間を確認してください。</p>
              ) : (
                <>
                  <StackedPattern
                    counts={input.pattern.counts}
                    compact
                    highlight={input.pattern.counts.map((_, col) =>
                      p.lines.some((b) => b.requirement[col] > 0) ? 1 : 0,
                    )}
                  />
                  {p.lines.map((b, j) => (
                    <div className="bet-line" key={j}>
                      <div>
                        <strong>
                          {kindLabel(b.kind)}：{requirementLabel(b.requirement)}
                        </strong>
                        <span>
                          {b.quantity}皿 · {b.quantity * b.unitCost}枚
                        </span>
                        <small>
                          操作順{' '}
                          {b.requirement.flatMap((n, c) => (n ? [columnLabel(c)] : [])).join(' → ')}{' '}
                          → 数量{b.quantity}
                        </small>
                      </div>
                      <button className="quiet" onClick={() => setQuote(b)}>
                        配当入力
                      </button>
                    </div>
                  ))}
                  <dl className="stats">
                    <div>
                      <dt>必要メダル</dt>
                      <dd>
                        {p.cost}
                        <small> 枚</small>
                      </dd>
                    </div>
                    <div>
                      <dt>購入皿数</dt>
                      <dd>
                        {p.lines.reduce((s, b) => s + b.quantity, 0)}
                        <small> 皿</small>
                      </dd>
                    </div>
                    <div>
                      <dt>何かが成立</dt>
                      <dd>{percent(p.probability)}</dd>
                    </div>
                    <div>
                      <dt>推定操作時間</dt>
                      <dd>
                        {number(p.seconds)}
                        <small> 秒</small>
                      </dd>
                    </div>
                  </dl>
                  <Money value={p.money} />
                  <details>
                    <summary>ハラハラ指標について</summary>
                    <p>
                      前半3球後の成立確率qに対する4q(1−q)を平均。行平均 {number(p.suspense)} /
                      1。楽しさの科学的な測定値ではありません。
                    </p>
                  </details>
                  <FreeChoicePanel input={input} lines={p.lines} />
                </>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="group-panel">
        <span className="eyebrow">03 · TOGETHER</span>
        <h2>同じ抽選を、みんなで見る</h2>
        <div className="group-metrics">
          <div>
            <span>誰か1人以上が成立</span>
            <strong>{percent(evaluation.any)}</strong>
          </div>
          <div>
            <span>全員が成立</span>
            <strong>{percent(evaluation.all)}</strong>
          </div>
        </div>
        <p>共通の5球で評価しています。同じBETの当たりは重なります。</p>
        {evaluation.continueAll !== null && (
          <p>全員が次回の同じBETを購入できる確率：{percent(evaluation.continueAll)}</p>
        )}
        <Money value={evaluation.groupMoney} />
      </section>
      <div className="model-note">
        <p>
          <strong>成立確率：仮定モデル内で厳密</strong> ／ 探索：近似
        </p>
        <p>
          収支分布：
          {evaluation.moneyAccuracy === 'exact'
            ? 'FCなし・厳密'
            : evaluation.moneyAccuracy === 'estimate'
              ? `seed付き推定（${evaluation.samples}試行、確率の95%誤差目安 ±${percent(evaluation.probabilityError ?? 0)}）／期待払出は厳密`
              : '配当不明'}
        </p>
        {result.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
        <details>
          <summary>計算・探索の範囲</summary>
          <p>
            候補 {result.candidates} → 最大36行中 {result.screened}
            行を保持。単独・数量候補から幅8、最大{input.rules.maxLines}
            行のビーム探索、個人3案から共同評価。{result.evaluated}案評価 /{' '}
            {number(result.elapsedMs)}ms。大域最適性は保証しません。
          </p>
        </details>
      </div>
      <SimulationPanel
        input={input}
        lines={selected.plans.map((p) => p.lines)}
        ready={known && selected.plans.every((p) => p.cost > 0)}
      />
      <div className="round-actions">
        <button
          className="primary"
          disabled={input.demo || recorded}
          onClick={() => setRecord(true)}
        >
          {recorded ? 'このラウンドは記録済み' : '実際の結果を記録'}
        </button>
        <button
          className="secondary"
          onClick={() => update((d) => ({ ...d, roundId: uid(), roundNumber: d.roundNumber + 1 }))}
        >
          次のラウンド →
        </button>
      </div>
      <p className="caption">推薦表示や次のラウンドへの移動では、残高は変わりません。</p>
      {quote && (
        <Dialog title="今回の配当を入力" onClose={() => setQuote(null)}>
          <BetRegistration initialLine={quote} onSaved={() => setQuote(null)} />
        </Dialog>
      )}
      {record && (
        <RecordDialog
          lines={selected.plans.map((p) => p.lines)}
          hash={result.inputHash}
          onClose={() => setRecord(false)}
        />
      )}
    </div>
  )
}
