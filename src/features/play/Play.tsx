import { useState } from 'react'
import { useApp } from '../../app/store'
import { StackedPattern } from '../../components/StackedPattern'
import { compatible } from '../../domain/keys'
import { presets, styles } from '../../domain/defaults'
import type { PlayerProfile, Style } from '../../domain/schema'
import type { CalculationInput } from '../../engine/types'
import { useCalculation } from '../../workers/useCalculation'
import { PatternList } from '../patterns/PatternList'
import { PlayerEditor } from './PlayerEditor'
import { Results } from './Results'
export function Play() {
  const { data, update, demo } = useApp(),
    [editing, setEditing] = useState<PlayerProfile | null>(null)
  const pattern = data.patterns.find((p) => p.id === data.selectedPatternId)
  const input: CalculationInput | null =
    pattern && compatible(pattern, data.rules)
      ? {
          pattern,
          rules: data.rules,
          players: data.players.slice(0, data.playerCount),
          quotes: data.quotes,
          manualBets: data.manualBets,
          roundId: data.roundId,
          style: data.style,
          demo,
        }
      : null
  const job = useCalculation(input)
  return (
    <div className="page-stack">
      <div className="hero">
        <div>
          <span className="eyebrow">LET’S PLAY TOGETHER</span>
          <h1>
            今日の一手を、
            <br className="mobile-break" />
            みんなで選ぼう。
          </h1>
          <p>型をタップして、当たり方をくらべる。</p>
        </div>
        <div className="round-stamp">
          <small>ROUND</small>
          <strong>{String(data.roundNumber).padStart(2, '0')}</strong>
        </div>
      </div>
      <section className="play-controls">
        <div className="control-row">
          <span>プレイ人数</span>
          <div className="segmented">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                aria-pressed={n === data.playerCount}
                onClick={() => update((d) => ({ ...d, playerCount: n }))}
              >
                {n}人
              </button>
            ))}
          </div>
        </div>
        <div className="style-switch">
          {Object.entries(styles).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={data.style === key}
              onClick={() =>
                update((d) => ({
                  ...d,
                  style: key as Style,
                  rules: { ...d.rules, weights: presets[key as Style] },
                }))
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <PatternList />
      {pattern && compatible(pattern, data.rules) ? (
        <section className="selected-pattern">
          <div>
            <span className="eyebrow">SELECTED</span>
            <h2>{pattern.name || '選択中の型'}</h2>
            <p>
              {pattern.counts.length}列 · 通常{pattern.total - pattern.special} / 特殊
              {pattern.special}
            </p>
          </div>
          <StackedPattern counts={pattern.counts} />
          <p className="caption">列番号は左から固定。同じ個数でも別の列です。</p>
        </section>
      ) : (
        <div className="notice">
          現在のルールに合う型を選択するか、「＋ 型を追加」から登録してください。
        </div>
      )}
      <section className="players-summary" aria-label="プレイヤーの条件">
        {data.players.slice(0, data.playerCount).map((p, i) => (
          <button key={p.id} onClick={() => setEditing(p)}>
            <span className="avatar">{i + 1}</span>
            <span>
              <strong>{p.name}</strong>
              <small>
                残高 {p.balance}枚 / 上限 {p.budget}枚
              </small>
            </span>
            <span className="edit-label">編集</span>
          </button>
        ))}
      </section>
      {job.busy && (
        <div className="calculating" role="status">
          <div className="spinner" />
          <div>
            <strong>抽選とBET候補を計算中</strong>
            <p>型や条件はそのまま変更できます。</p>
          </div>
          <button onClick={job.cancel}>中止</button>
        </div>
      )}
      {job.cancelled && (
        <div className="notice">
          計算を中止しました。<button onClick={job.retry}>再計算</button>
        </div>
      )}
      {job.reply?.error && (
        <p role="alert" className="notice error">
          {job.reply.error}
        </p>
      )}
      {job.reply?.result && input && (
        <Results key={job.reply.requestId} result={job.reply.result} input={input} />
      )}
      {editing && <PlayerEditor player={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
