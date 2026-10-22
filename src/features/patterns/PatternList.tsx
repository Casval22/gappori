import { useState } from 'react'
import { useApp } from '../../app/store'
import { StackedPattern } from '../../components/StackedPattern'
import { compatible } from '../../domain/keys'
import type { Pattern } from '../../domain/schema'
import { PatternEditor } from './PatternEditor'
export function PatternList({ manage = false }: { manage?: boolean }) {
  const { data, update } = useApp(),
    [editing, setEditing] = useState<Pattern | 'new' | null>(null)
  const ordered = [...data.patterns].sort((a, b) => a.order - b.order)
  function move(id: string, direction: number) {
    const next = [...ordered],
      i = next.findIndex((p) => p.id === id),
      j = i + direction
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    update((d) => ({ ...d, patterns: next.map((p, index) => ({ ...p, order: index })) }))
  }
  return (
    <section aria-label="型の一覧">
      <div className="section-heading">
        <div>
          <span className="eyebrow">01 · PATTERN</span>
          <h2>{manage ? '型の管理' : 'いまの型を選ぶ'}</h2>
        </div>
        <button className="secondary" onClick={() => setEditing('new')}>
          ＋ 型を追加
        </button>
      </div>
      <div className={`pattern-grid ${manage ? 'management' : ''}`}>
        {ordered.map((p, index) => {
          const valid = compatible(p, data.rules)
          return (
            <div
              key={p.id}
              className={`pattern-item ${data.selectedPatternId === p.id ? 'selected' : ''}`}
            >
              <button
                className="pattern-button"
                disabled={!valid}
                aria-pressed={data.selectedPatternId === p.id}
                aria-label={`${p.favorite ? 'お気に入り ' : ''}${p.name || '型'} ${p.counts.join(',')}`}
                onClick={() => update((d) => ({ ...d, selectedPatternId: p.id }))}
              >
                <div className="pattern-name">
                  {p.favorite ? '★ ' : ''}
                  {p.name || `${p.counts.length}列の型`}
                </div>
                <StackedPattern counts={p.counts} compact />
                {!valid && (
                  <small>
                    現在のルールと不一致（{p.total}枠・特殊{p.special}）
                  </small>
                )}
              </button>
              {manage && (
                <div className="pattern-tools">
                  <button
                    aria-label={`${p.name}のお気に入り`}
                    onClick={() =>
                      update((d) => ({
                        ...d,
                        patterns: d.patterns.map((q) =>
                          q.id === p.id ? { ...q, favorite: !q.favorite } : q,
                        ),
                      }))
                    }
                  >
                    {p.favorite ? '★ 解除' : '☆ 保存'}
                  </button>
                  <button onClick={() => setEditing(p)}>編集</button>
                  <button disabled={index === 0} onClick={() => move(p.id, -1)}>
                    前へ
                  </button>
                  <button disabled={index === ordered.length - 1} onClick={() => move(p.id, 1)}>
                    後へ
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (window.confirm('この型を削除しますか？ 過去の履歴は残ります。'))
                        update((d) => ({
                          ...d,
                          patterns: d.patterns.filter((q) => q.id !== p.id),
                          selectedPatternId:
                            d.selectedPatternId === p.id ? null : d.selectedPatternId,
                        }))
                    }}
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="caption">初期の4型は表示確認用サンプルです。色はアプリ独自の識別色です。</p>
      {editing && (
        <PatternEditor
          existing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}
