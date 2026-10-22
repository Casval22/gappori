import { useState } from 'react'
import { useApp } from '../../app/store'
import { Dialog } from '../../components/Dialog'
import { StackedPattern } from '../../components/StackedPattern'
import { columnLabel, patternKey } from '../../domain/keys'
import { patternSchema, type Pattern } from '../../domain/schema'
import { uid } from '../../domain/defaults'
export function PatternEditor({ existing, onClose }: { existing?: Pattern; onClose: () => void }) {
  const { data, update } = useApp()
  const [counts, setCounts] = useState(existing?.counts ?? [1, 2, 3, 4, 5]),
    [name, setName] = useState(existing?.name ?? '')
  const [error, setError] = useState('')
  const total = counts.reduce((a, b) => a + b, 0),
    required = data.rules.total - data.rules.special
  const candidate = {
    id: existing?.id ?? 'new',
    name,
    counts: [...counts].sort((a, b) => a - b),
    total: data.rules.total,
    special: data.rules.special,
    favorite: existing?.favorite ?? false,
    order: existing?.order ?? data.patterns.length,
  }
  const valid = patternSchema.safeParse(candidate).success
  const duplicate = valid
    ? data.patterns.find((p) => p.id !== existing?.id && patternKey(p) === patternKey(candidate))
    : undefined
  const change = (i: number, n: number) => setCounts(counts.map((c, j) => (j === i ? n : c)))
  function save() {
    if (!valid || duplicate) return
    if (existing && !window.confirm('この型を更新しますか？ 過去の履歴は変わりません。')) return
    try {
      const pattern = { ...candidate, id: existing?.id ?? uid() }
      update((d) => ({
        ...d,
        patterns: existing
          ? d.patterns.map((p) => (p.id === existing.id ? pattern : p))
          : [...d.patterns, pattern],
        selectedPatternId: pattern.id,
      }))
      onClose()
    } catch {
      setError('保存できません。型は100件まで登録できます。')
    }
  }
  return (
    <Dialog title={existing ? '型を編集' : '型を追加'} onClose={onClose}>
      <p className="muted">列は編集中の順番を保ち、保存時に少ない順に並びます。</p>
      <label className="field">
        名前（任意）
        <input
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="名前なしでも使えます"
        />
      </label>
      <StackedPattern counts={counts} />
      <p className={`total ${valid ? 'valid' : ''}`} aria-live="polite">
        合計 {Number.isFinite(total) ? total : '—'} / 必要 {required} ポケット
      </p>
      <div className="column-editors">
        {counts.map((n, i) => (
          <div className="column-editor" key={i}>
            <label htmlFor={`column-${i}`}>{columnLabel(i)}</label>
            <button
              aria-label={`${columnLabel(i)}を減らす`}
              onClick={() => change(i, Math.max(1, (n || 1) - 1))}
            >
              −
            </button>
            <input
              id={`column-${i}`}
              aria-label={`列${i + 1}の個数`}
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              step={1}
              value={Number.isFinite(n) ? n : ''}
              onChange={(e) => change(i, e.target.value === '' ? NaN : Number(e.target.value))}
            />
            <button
              aria-label={`${columnLabel(i)}を増やす`}
              onClick={() => change(i, Math.min(20, (n || 0) + 1))}
            >
              ＋
            </button>
            <button
              className="quiet"
              disabled={counts.length === 1}
              aria-label={`${columnLabel(i)}を削除`}
              onClick={() => setCounts(counts.filter((_, j) => i !== j))}
            >
              削除
            </button>
          </div>
        ))}
      </div>
      <button
        className="secondary full"
        disabled={counts.length >= 8}
        onClick={() => setCounts([...counts, 1])}
      >
        ＋ 列を追加（{counts.length}/8）
      </button>
      {duplicate && (
        <div className="notice">
          同じ型が登録済みです。
          <button
            onClick={() => {
              update((d) => ({ ...d, selectedPatternId: duplicate.id }))
              onClose()
            }}
          >
            既存の型を選択
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <button className="primary full" disabled={!valid || !!duplicate} onClick={save}>
        {existing ? '変更を保存' : '追加して選択'}
      </button>
    </Dialog>
  )
}
