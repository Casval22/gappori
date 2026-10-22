import { useState } from 'react'
import { useApp } from '../../app/store'
import { NumberField } from '../../components/Fields'
import { presets, styles } from '../../domain/defaults'
import { ruleSchema, type RuleProfile, type Weights } from '../../domain/schema'
import { BetRegistration } from './BetRegistration'
export function Settings() {
  const { data, update, demo, setDemo } = useApp()
  const [rules, setRules] = useState<RuleProfile>(structuredClone(data.rules)),
    [message, setMessage] = useState('')
  const set = <K extends keyof RuleProfile>(key: K, value: RuleProfile[K]) =>
    setRules((r) => ({ ...r, [key]: value }))
  const numeric = (
    key:
      | 'total'
      | 'special'
      | 'getaCost'
      | 'boatCost'
      | 'maxQuantity'
      | 'quantityStep'
      | 'maxLines'
      | 'secondsPerTap'
      | 'jackpotThreshold'
      | 'horizon'
      | 'continuationK'
      | 'trials'
      | 'seed',
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <NumberField
      label={label}
      min={min}
      max={max}
      step={step}
      value={rules[key]}
      onChange={(v) => set(key, v ?? NaN)}
    />
  )
  return (
    <div className="page-stack">
      <div className="page-title">
        <span className="eyebrow">PREFERENCES</span>
        <h1>自分たちの条件に合わせる</h1>
        <p>未確認のルールは、比較のための仮説として設定します。</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const result = ruleSchema.safeParse(rules)
          if (!result.success) {
            setMessage(result.error.issues[0].message)
            return
          }
          if (
            window.confirm('ルール設定を更新しますか？ 配当はこのルールで再確認が必要になります。')
          ) {
            update((d) => ({ ...d, rules: result.data }))
            setMessage('設定を保存しました')
          }
        }}
      >
        <section className="panel">
          <h2>抽選モデルと費用</h2>
          <p className="muted">
            5球（前半3＋後半2）、各ポケットが等確率の非復元抽選。特殊枠の追加報酬は対象外です。
          </p>
          <div className="form-grid">
            {numeric('total', '総ポケット数', 6, 20)}
            {numeric('special', '特殊ポケット数', 0, 19)}
            {numeric('getaCost', '下駄1皿の費用', 1, 10000)}
            {numeric('boatCost', '舟1皿の費用', 1, 10000)}
            {numeric('maxQuantity', '同一BETの皿数上限', 1, 100)}
            {numeric('quantityStep', '購入数量の単位', 1, 100)}
            {numeric('maxLines', '1人の異なるBET数上限', 1, 3)}
          </div>
          <p className="caption">初期費用（下駄5枚・舟10枚）と上限30皿は仮設定です。</p>
        </section>
        <section className="panel">
          <h2>FC（フリーチョイス）の仮説</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={rules.fcEnabled}
              onChange={(e) => set('fcEnabled', e.target.checked)}
            />{' '}
            FCを計算に含める
          </label>
          <div className="form-grid">
            <NumberField
              label="下駄のFC獲得率"
              suffix="%"
              nullable
              min={0}
              max={100}
              step={0.01}
              value={rules.getaFc === null ? null : rules.getaFc * 100}
              onChange={(v) => set('getaFc', v === null ? null : v / 100)}
            />
            <NumberField
              label="舟のFC獲得率"
              suffix="%"
              nullable
              min={0}
              max={100}
              step={0.01}
              value={rules.boatFc === null ? null : rules.boatFc * 100}
              onChange={(v) => set('boatFc', v === null ? null : v / 100)}
            />
            <label className="field">
              獲得判定
              <select
                value={rules.fcTrial}
                onChange={(e) => set('fcTrial', e.target.value as RuleProfile['fcTrial'])}
              >
                <option value="line">1BET行につき1回</option>
                <option value="plate">皿ごと独立・1回以上獲得</option>
              </select>
            </label>
            <label className="field">
              FCの効果
              <select
                value={rules.fcEffect}
                onChange={(e) => set('fcEffect', e.target.value as RuleProfile['fcEffect'])}
              >
                <option value="one">選んだ列の要求を1貫満たす</option>
                <option value="all">選んだ列の未充足要求を全て満たす</option>
              </select>
            </label>
            <label className="field">
              選択可能な列
              <select
                value={rules.fcEligible}
                onChange={(e) => set('fcEligible', e.target.value as RuleProfile['fcEligible'])}
              >
                <option value="unseen">前半3球で未出現の列</option>
                <option value="unfilled">要求が未充足の列</option>
              </select>
            </label>
          </div>
          <p className="notice">
            空欄は「不明」、0は「獲得しない」です。不明の皿種はFCを除外します。各行最大1個、その行だけに適用。行間・プレイヤー間の獲得は独立と仮定し、共通付与は扱いません。
          </p>
        </section>
        <section className="panel">
          <h2>好みと操作量</h2>
          <div className="form-grid">
            <label className="field">
              グループの目標
              <select
                value={rules.groupGoal}
                onChange={(e) => set('groupGoal', e.target.value as RuleProfile['groupGoal'])}
              >
                <option value="any">誰かが当てる</option>
                <option value="continue">全員が続ける</option>
                <option value="all">一緒に当てる</option>
              </select>
            </label>
            {numeric('jackpotThreshold', '大当たりと考える純増枚数', 1, 1000000)}
            {numeric('secondsPerTap', '1操作の推定秒数', 0.1, 30, 0.1)}
            <NumberField
              label="操作時間上限"
              suffix="秒・空欄は制限なし"
              nullable
              min={1}
              max={600}
              value={rules.maxSeconds}
              onChange={(v) => set('maxSeconds', v)}
            />
          </div>
          <p className="muted">
            操作時間はBET種選択・列選択・数量変更からの目安です。実測ではありません。
          </p>
          <details>
            <summary>評価の重みを調整</summary>
            <div className="button-row">
              {Object.entries(styles).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => set('weights', presets[key as keyof typeof presets])}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="form-grid">
              {Object.entries({
                frequency: '当たりやすさ',
                profit: '期待純増',
                thrill: '前半のハラハラ',
                jackpot: '大当たり確率',
                group: 'グループ目標',
                operations: '操作の少なさ',
                economy: '費用の少なさ',
              }).map(([key, label]) => (
                <NumberField
                  key={key}
                  label={label}
                  value={rules.weights[key as keyof Weights]}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(v) => set('weights', { ...rules.weights, [key]: v ?? NaN })}
                />
              ))}
            </div>
          </details>
        </section>
        <section className="panel">
          <h2>条件付き持続シミュレーション</h2>
          <p className="muted">
            現在の型・配当・ルール・BETを固定。数量は減らさず、費用を払えなくなった人は停止します。
          </p>
          <div className="form-grid">
            {numeric('horizon', '試行上限 H（ラウンド）', 1, 500)}
            {numeric('continuationK', '継続確率を知りたい K 回', 1, 500)}
            {numeric('trials', '試行数', 100, 5000)}
            {numeric('seed', '乱数seed', 0, 4294967295)}
            <NumberField
              label="1ラウンドの秒数"
              nullable
              min={1}
              max={3600}
              value={rules.roundSeconds}
              onChange={(v) => set('roundSeconds', v)}
            />
          </div>
        </section>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <button className="primary full" type="submit">
          ルール設定を保存
        </button>
      </form>
      <BetRegistration />
      <section className="panel">
        <h2>架空配当で試す</h2>
        <p className="muted">
          下駄・丸皿2倍、舟12倍の架空の総払出を使います。実機の配当ではありません。デモ中の結果記録はできません。デモ中の設定変更は一時的で、終了すると元に戻ります。
        </p>
        <button className={demo ? 'danger' : 'secondary'} onClick={() => setDemo(!demo)}>
          {demo ? 'デモを終了' : '架空配当のデモを開始'}
        </button>
      </section>
    </div>
  )
}
