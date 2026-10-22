import { useState } from 'react'
import { useApp } from '../../app/store'
import { Dialog } from '../../components/Dialog'
import { NumberField } from '../../components/Fields'
import { styles } from '../../domain/defaults'
import { playerSchema, type PlayerProfile, type Style } from '../../domain/schema'
export function PlayerEditor({ player, onClose }: { player: PlayerProfile; onClose: () => void }) {
  const { update } = useApp(),
    [draft, setDraft] = useState(player)
  return (
    <Dialog title={`${player.name}の条件`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const valid = playerSchema.safeParse(draft)
          if (valid.success && window.confirm('このプレイヤーの条件を更新しますか？')) {
            update((d) => ({
              ...d,
              players: d.players.map((p) => (p.id === player.id ? valid.data : p)),
            }))
            onClose()
          }
        }}
      >
        <label className="field">
          名前
          <input
            required
            maxLength={30}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <NumberField
          label="残高"
          value={draft.balance}
          onChange={(v) => setDraft({ ...draft, balance: v ?? NaN })}
        />
        <NumberField
          label="1回のBET上限"
          value={draft.budget}
          onChange={(v) => setDraft({ ...draft, budget: v ?? NaN })}
        />
        <label className="field">
          個人の好み
          <select
            value={draft.preference}
            onChange={(e) => setDraft({ ...draft, preference: e.target.value as Style })}
          >
            {Object.entries(styles).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary full"
          type="submit"
          disabled={!playerSchema.safeParse(draft).success}
        >
          条件を保存
        </button>
      </form>
    </Dialog>
  )
}
