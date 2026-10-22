import { useState } from 'react'
import type { BetLine } from '../../domain/schema'
import type { CalculationInput } from '../../engine/types'
import { useCalculation } from '../../workers/useCalculation'
import { number, percent } from '../../domain/format'
export function SimulationPanel({
  input,
  lines,
  ready,
}: {
  input: CalculationInput
  lines: BetLine[][]
  ready: boolean
}) {
  const [started, setStarted] = useState(false),
    job = useCalculation(started && ready ? input : null, 'simulate', lines)
  const result = job.reply?.simulation
  return (
    <section className="panel">
      <h2>この条件なら、どれくらい続く？</h2>
      <p className="muted">
        現在の型・配当・ルール・BETを固定し、独立なラウンドを反復する条件付き推定です。費用を払えない人は停止し、数量は減らしません。
      </p>
      {!ready && <p className="notice">全員の購入BETと今回の配当が揃うと計算できます。</p>}
      {!started && (
        <button className="secondary" disabled={!ready} onClick={() => setStarted(true)}>
          持続性をシミュレーション
        </button>
      )}
      {job.busy && (
        <p role="status">
          試行を実行中… <button onClick={job.cancel}>中止</button>
        </p>
      )}
      {job.cancelled && <button onClick={job.retry}>シミュレーションを再開</button>}
      {job.reply?.error && <p role="alert">{job.reply.error}</p>}
      {result && (
        <div>
          <span className="badge">推定 · seed {result.seed}</span>
          <div className="form-grid">
            {(
              [
                ['1人でも停止するまで', result.firstStop],
                ['最後の1人が停止するまで', result.lastStop],
              ] as const
            ).map(([title, s]) => (
              <div className="metric-box" key={title}>
                <h3>{title}</h3>
                <strong>
                  {number(s.mean)}
                  <small> 回（上限付き平均）</small>
                </strong>
                <p>中央値 {number(s.median)}回</p>
                <p>
                  {result.k}回以上：{percent(s.surviveK)}
                  <br />
                  95%信頼区間 {percent(s.interval[0])}〜{percent(s.interval[1])}
                </p>
                <p>
                  {result.k}回未満で終了：{percent(s.earlyStop)}
                  <br />
                  上限打切り：{s.censored} / {result.trials}試行
                </p>
              </div>
            ))}
          </div>
          <p className="caption">
            H={result.horizon}回で打切り。無制限の期待寿命ではありません。
            {result.minutes !== null &&
              `最初の停止までの上限付き平均 ${number(result.minutes)}分（入力秒数で換算）。`}
            実機のプレイ時間を保証しません。
          </p>
        </div>
      )}
    </section>
  )
}
