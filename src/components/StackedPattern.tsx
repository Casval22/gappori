import { columnLabel } from '../domain/keys'
const columnColors = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
  '#6B7280',
]
export function StackedPattern({
  counts,
  highlight = [],
  compact = false,
}: {
  counts: number[]
  highlight?: number[]
  compact?: boolean
}) {
  const max = Math.max(1, ...counts.filter(Number.isFinite))
  const towerHeight = compact ? 64 : 154
  const gap = Math.min(compact ? 2 : 3, towerHeight / (max * 4))
  const blockHeight = (towerHeight - 5 - gap * (max - 1)) / max
  return (
    <div
      className={`stacked ${compact ? 'compact' : ''}`}
      role="img"
      aria-label={`型：${counts.map((n, i) => `${columnLabel(i)} ${n}個`).join('、')}`}
    >
      {counts.map((count, i) => (
        <div key={i} className={`stack-column ${highlight[i] ? 'highlight' : ''}`}>
          <div className="stack-count">{Number.isFinite(count) ? count : '—'}</div>
          <div className="stack-tower" style={{ height: towerHeight, gap }}>
            {Array.from({ length: Math.min(20, Math.max(0, Math.floor(count) || 0)) }, (_, j) => (
              <span
                key={j}
                className="stack-block"
                style={{ backgroundColor: columnColors[i], height: blockHeight }}
              />
            ))}
          </div>
          <span className="column-label">{columnLabel(i)}</span>
        </div>
      ))}
    </div>
  )
}
