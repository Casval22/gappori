import { useState } from 'react'
import { useApp, getRawBackup } from '../../app/store'
import { Dialog } from '../../components/Dialog'
import { StackedPattern } from '../../components/StackedPattern'
import { MAX_BACKUP_BYTES, parseBackup } from '../../storage/repository'
import { createInitialData } from '../../domain/defaults'
import { undoLast } from '../../domain/rounds'
import { kindLabel, requirementLabel } from '../../domain/keys'
import type { AppData } from '../../domain/schema'
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })),
    a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function History() {
  const { data, update, replace, demo } = useApp(),
    [error, setError] = useState(''),
    [pending, setPending] = useState<AppData | null>(null)
  return (
    <div className="page-stack">
      <div className="page-title">
        <span className="eyebrow">YOUR RECORDS</span>
        <h1>履歴・データ管理</h1>
        <p>実際に記録した結果だけが、残高に反映されます。</p>
      </div>
      <section className="panel">
        <h2>このブラウザに保存しています</h2>
        {demo && (
          <p className="notice">
            デモ中の変更は一時的です。バックアップ・復元・初期化はデモ終了後に行ってください。
          </p>
        )}
        <p>
          別端末には自動共有されません。ブラウザのデータ削除で失われます。ときどきJSONでバックアップしてください。
        </p>
        <div className="button-row">
          <button
            disabled={demo}
            className="primary"
            onClick={() => download(JSON.stringify(data, null, 2), 'gappori-backup.json')}
          >
            JSONをエクスポート
          </button>
          <button
            onClick={() => {
              const raw = getRawBackup()
              if (raw) download(raw, 'gappori-original.json')
              else setError('退避する保存データがありません')
            }}
          >
            保存中の元JSONを退避
          </button>
        </div>
        <label className="field">
          JSONから復元（2MB以下）
          <input
            type="file"
            disabled={demo}
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                if (file.size > MAX_BACKUP_BYTES) throw new Error('JSONは2MB以下にしてください')
                setPending(parseBackup(await file.text()))
                setError('')
              } catch (err) {
                setError(err instanceof Error ? err.message : '読み込みに失敗しました')
              }
            }}
          />
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h2>
            プレイ記録 <small>{data.history.length} / 200</small>
          </h2>
          <button
            disabled={!data.history.length}
            onClick={() => {
              if (window.confirm('直前の記録を取り消し、残高を戻しますか？')) {
                try {
                  update(undoLast)
                  setError('')
                } catch (err) {
                  setError(err instanceof Error ? err.message : '取消に失敗しました')
                }
              }
            }}
          >
            直前の記録を取消
          </button>
        </div>
        {!data.history.length && (
          <div className="empty">
            <span className="empty-mark">記</span>
            <h3>まだプレイ記録はありません</h3>
            <p>プレイ画面の「実際の結果を記録」から残せます。</p>
          </div>
        )}
        {[...data.history].reverse().map((h) => (
          <article className="panel" key={h.id}>
            <div className="section-heading">
              <h3>
                ROUND {h.number} · {h.pattern.name || '名前なし'}
              </h3>
              <small>{new Date(h.recordedAt).toLocaleString('ja-JP')}</small>
            </div>
            <StackedPattern counts={h.pattern.counts} compact />
            <div className="history-entries">
              {h.entries.map((entry, i) => (
                <div key={entry.playerId}>
                  <strong>
                    {h.players[i].name}：{h.before[i]} → {h.after[i]}枚
                  </strong>
                  <p>
                    BET {entry.actualCost} / 払出 {entry.payout} / 追加支出 {entry.extraCost} /
                    追加獲得 {entry.extraPayout}
                  </p>
                  <small>
                    計算時BET：
                    {h.bets[i]
                      .map(
                        (b) =>
                          `${kindLabel(b.kind)} ${requirementLabel(b.requirement)} ${b.quantity}皿`,
                      )
                      .join(' ／ ') || 'なし'}
                  </small>
                </div>
              ))}
            </div>
            <details>
              <summary>記録時のルール</summary>
              <p>
                総{h.rules.total} / 特殊{h.rules.special}、FC {h.rules.fcEnabled ? '有効' : '除外'}
                、下駄 {h.rules.getaFc === null ? '不明' : `${h.rules.getaFc * 100}%`} / 舟{' '}
                {h.rules.boatFc === null ? '不明' : `${h.rules.boatFc * 100}%`}
              </p>
            </details>
          </article>
        ))}
      </section>
      <details className="panel">
        <summary>データの整理・初期化</summary>
        <p>必要なJSONを書き出してから操作してください。履歴の整理では残高を変更しません。</p>
        <div className="button-row">
          <button
            onClick={() => {
              if (
                window.confirm(
                  '全履歴を削除しますか？ この操作は取り消せません。残高は現在の値を保持します。',
                )
              )
                update((d) => ({
                  ...d,
                  history: [],
                  roundId: crypto.randomUUID(),
                  roundNumber: d.roundNumber + 1,
                }))
            }}
          >
            履歴を整理
          </button>
          <button
            onClick={() => {
              if (window.confirm('登録済み配当と丸皿をすべて削除しますか？'))
                update((d) => ({ ...d, quotes: [], manualBets: [] }))
            }}
          >
            配当・丸皿を整理
          </button>
          <button
            disabled={demo}
            className="danger"
            onClick={() => {
              if (
                window.confirm(
                  'このブラウザ内の全データを削除し、初期状態に戻しますか？ バックアップがないと復元できません。',
                )
              )
                replace(createInitialData())
            }}
          >
            全データを初期化
          </button>
        </div>
      </details>
      {pending && (
        <Dialog title="JSONの復元を確認" onClose={() => setPending(null)}>
          <p>
            型{pending.patterns.length}件・履歴{pending.history.length}件・{pending.playerCount}
            人のデータです。現在の型・設定・残高・履歴を置き換えます。
          </p>
          <button
            className="primary full"
            onClick={() => {
              replace(pending)
              setPending(null)
            }}
          >
            確認してデータを置き換える
          </button>
          <button className="full" onClick={() => setPending(null)}>
            キャンセル
          </button>
        </Dialog>
      )}
    </div>
  )
}
