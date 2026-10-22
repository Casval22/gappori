import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { StackedPattern } from './StackedPattern'
import { NumberField } from './Fields'
import { useState } from 'react'
describe('スマホ向けの入力と図', () => {
  it('8列のブロック・列番号・個数が別々に表示される', () => {
    const counts = [1, 1, 1, 1, 2, 2, 3, 4]
    const { container } = render(<StackedPattern counts={counts} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(
      '型：① 1個、② 1個、③ 1個、④ 1個、⑤ 2個、⑥ 2個、⑦ 3個、⑧ 4個',
    )
    expect(container.querySelectorAll('.stack-column')).toHaveLength(8)
    expect(container.querySelectorAll('.stack-block')).toHaveLength(15)
  })
  it('FC入力の空欄と0を分ける', async () => {
    function Field() {
      const [v, set] = useState<number | null>(null)
      return (
        <>
          <NumberField label="FC率" nullable value={v} onChange={set} />
          <output>{v === null ? '不明' : v}</output>
        </>
      )
    }
    const user = userEvent.setup()
    render(<Field />)
    expect(screen.getByRole('status')).toHaveTextContent('不明')
    await user.type(screen.getByLabelText('FC率'), '0')
    expect(screen.getByRole('status')).toHaveTextContent('0')
    await user.clear(screen.getByLabelText('FC率'))
    expect(screen.getByRole('status')).toHaveTextContent('不明')
  })
})
