import { createInitialData } from '../domain/defaults'
import { patternKey, ruleKey } from '../domain/keys'
import type { BetLine, PayoutQuote } from '../domain/schema'
import type { CalculationInput } from '../engine/types'
export function input(): CalculationInput {
  const data = createInitialData()
  return {
    pattern: data.patterns[0],
    rules: { ...data.rules, fcEnabled: false },
    players: data.players.slice(0, 1),
    quotes: [],
    manualBets: [],
    roundId: 'test-round',
    style: 'balanced',
    demo: false,
  }
}
export const geta: BetLine = {
  kind: 'geta',
  requirement: [0, 0, 1, 1, 1],
  quantity: 1,
  unitCost: 5,
}
export const boat: BetLine = {
  kind: 'boat',
  requirement: [0, 1, 1, 1, 2],
  quantity: 1,
  unitCost: 10,
}
export function quote(
  ctx: CalculationInput,
  line: BetLine,
  gross = 20,
  overrides: Partial<PayoutQuote> = {},
): PayoutQuote {
  return {
    id: `q-${line.kind}`,
    patternKey: patternKey(ctx.pattern),
    ruleKey: ruleKey(ctx.rules),
    requirement: line.requirement,
    kind: line.kind,
    source: 'manual',
    scope: 'perPlate',
    quantity: line.quantity,
    gross,
    roundId: ctx.roundId,
    ...overrides,
  }
}
