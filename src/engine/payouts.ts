import type { BetLine, Pattern, PayoutQuote, RuleProfile } from '../domain/schema'
import { patternKey, ruleKey } from '../domain/keys'
export interface QuoteContext {
  pattern: Pattern
  rules: RuleProfile
  quotes: PayoutQuote[]
  roundId: string
  demo: boolean
}
export function payout(line: BetLine, ctx: QuoteContext): number | null {
  const q = [...ctx.quotes]
    .reverse()
    .find(
      (q) =>
        q.patternKey === patternKey(ctx.pattern) &&
        q.ruleKey === ruleKey(ctx.rules) &&
        q.roundId === ctx.roundId &&
        q.kind === line.kind &&
        q.requirement.join(',') === line.requirement.join(',') &&
        (q.scope === 'perPlate' || q.quantity === line.quantity) &&
        (ctx.demo || q.source !== 'demo'),
    )
  if (q) return q.gross * (q.scope === 'perPlate' ? line.quantity : 1)
  // Only reachable after the explicit demo action; never persisted as real quotations.
  return ctx.demo ? line.unitCost * line.quantity * (line.kind === 'boat' ? 12 : 2) : null
}
