import { useId } from 'react'
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 1_000_000_000,
  step = 1,
  nullable = false,
  suffix,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  nullable?: boolean
  suffix?: string
}) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {suffix && <small>（{suffix}）</small>}
      </span>
      <input
        id={id}
        type="number"
        inputMode={step < 1 ? 'decimal' : 'numeric'}
        min={min}
        max={max}
        step={step}
        value={value !== null && Number.isFinite(value) ? value : ''}
        placeholder={nullable ? '不明 / 未設定' : ''}
        required={!nullable}
        onChange={(e) =>
          onChange(e.target.value === '' ? (nullable ? null : NaN) : Number(e.target.value))
        }
      />
    </label>
  )
}
