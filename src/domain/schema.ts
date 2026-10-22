import { z } from 'zod'

const integer = (min: number, max: number) => z.number().int().min(min).max(max)
const money = integer(0, 1_000_000_000)
const id = z.string().min(1).max(100)
const vector = z.array(integer(0, 20)).min(1).max(8)
export const styleSchema = z.enum(['lasting', 'balanced', 'jackpot', 'group'])
export const weightsSchema = z.object({
  frequency: z.number().min(0).max(5),
  profit: z.number().min(0).max(5),
  thrill: z.number().min(0).max(5),
  jackpot: z.number().min(0).max(5),
  group: z.number().min(0).max(5),
  operations: z.number().min(0).max(5),
  economy: z.number().min(0).max(5),
})
export const ruleSchema = z
  .object({
    version: z.literal(1),
    total: integer(6, 20),
    special: integer(0, 19),
    getaCost: integer(1, 10000),
    boatCost: integer(1, 10000),
    maxQuantity: integer(1, 100),
    quantityStep: integer(1, 100),
    maxLines: integer(1, 3),
    fcEnabled: z.boolean(),
    getaFc: z.number().min(0).max(1).nullable(),
    boatFc: z.number().min(0).max(1).nullable(),
    fcTrial: z.enum(['line', 'plate']),
    fcEffect: z.enum(['one', 'all']),
    fcEligible: z.enum(['unseen', 'unfilled']),
    secondsPerTap: z.number().min(0.1).max(30),
    maxSeconds: z.number().min(1).max(600).nullable(),
    groupGoal: z.enum(['any', 'continue', 'all']),
    jackpotThreshold: integer(1, 1000000),
    weights: weightsSchema,
    horizon: integer(1, 500),
    continuationK: integer(1, 500),
    trials: integer(100, 5000),
    seed: integer(0, 4294967295),
    roundSeconds: integer(1, 3600).nullable(),
  })
  .refine(
    (r) => r.special < r.total && r.quantityStep <= r.maxQuantity && r.continuationK <= r.horizon,
    '特殊数・数量単位・継続回数の範囲を確認してください',
  )
export const patternSchema = z
  .object({
    id,
    name: z.string().max(60),
    counts: z.array(integer(1, 20)).min(1).max(8),
    total: integer(6, 20),
    special: integer(0, 19),
    favorite: z.boolean(),
    order: integer(0, 1000),
  })
  .refine(
    (p) =>
      p.total > p.special &&
      p.counts.reduce((a, b) => a + b, 0) === p.total - p.special &&
      p.counts.every((x, i) => i === 0 || x >= p.counts[i - 1]),
    '型の合計または昇順が不正です',
  )
export const playerSchema = z.object({
  id,
  name: z.string().min(1).max(30),
  balance: money,
  budget: money,
  preference: styleSchema,
})
export const betSchema = z
  .object({
    kind: z.enum(['geta', 'boat', 'round']),
    requirement: vector,
    quantity: integer(1, 100),
    unitCost: integer(1, 10000),
  })
  .refine(
    (b) =>
      b.requirement.reduce((a, v) => a + v, 0) ===
        (b.kind === 'geta'
          ? 3
          : b.kind === 'boat'
            ? 5
            : b.requirement.reduce((a, v) => a + v, 0)) &&
      (b.kind !== 'round' || [1, 2].includes(b.requirement.reduce((a, v) => a + v, 0))),
    '要求数が不正です',
  )
export const quoteSchema = z.object({
  id,
  patternKey: z.string().min(1).max(200),
  ruleKey: z.string().min(1).max(3000),
  kind: z.enum(['geta', 'boat', 'round']),
  requirement: vector,
  source: z.enum(['manual', 'demo']),
  scope: z.enum(['perPlate', 'quantity']),
  quantity: integer(1, 100),
  gross: money,
  roundId: id,
})
export const manualBetSchema = z.object({
  id,
  patternKey: z.string().min(1).max(200),
  ruleKey: z.string().min(1).max(3000),
  roundId: id,
  line: betSchema,
})
export const settlementSchema = z.object({
  playerId: id,
  actualCost: money,
  payout: money,
  extraCost: money,
  extraPayout: money,
})
export const snapshotSchema = z
  .object({
    id,
    number: integer(1, 1000000),
    recordedAt: z.string().datetime(),
    pattern: patternSchema,
    rules: ruleSchema,
    players: z.array(playerSchema).min(1).max(4),
    bets: z.array(z.array(betSchema).max(3)).min(1).max(4),
    quotes: z.array(quoteSchema).max(500),
    inputHash: z.string().max(100000),
    entries: z.array(settlementSchema).min(1).max(4),
    before: z.array(money).min(1).max(4),
    after: z.array(money).min(1).max(4),
  })
  .refine(
    (s) =>
      s.players.length === s.bets.length &&
      s.players.length === s.entries.length &&
      s.players.length === s.before.length &&
      s.players.length === s.after.length &&
      s.entries.every(
        (e, i) =>
          e.playerId === s.players[i].id &&
          s.before[i] === s.players[i].balance &&
          s.after[i] === s.before[i] - e.actualCost - e.extraCost + e.payout + e.extraPayout,
      ),
    '履歴の残高対応が不正です',
  )
export const appDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    patterns: z.array(patternSchema).max(100),
    rules: ruleSchema,
    players: z.array(playerSchema).length(4),
    playerCount: integer(1, 4),
    style: styleSchema,
    selectedPatternId: id.nullable(),
    roundId: id,
    roundNumber: integer(1, 1000000),
    quotes: z.array(quoteSchema).max(500),
    manualBets: z.array(manualBetSchema).max(100),
    history: z.array(snapshotSchema).max(200),
  })
  .superRefine((d, ctx) => {
    const unique = (values: string[]) => new Set(values).size === values.length
    if (
      !unique(d.patterns.map((p) => p.id)) ||
      !unique(d.patterns.map((p) => `${p.total}/${p.special}/${p.counts.join(',')}`)) ||
      !unique(d.players.map((p) => p.id)) ||
      !unique(d.history.map((h) => h.id)) ||
      !unique(d.quotes.map((q) => q.id))
    )
      ctx.addIssue({ code: 'custom', message: 'IDまたは型が重複しています' })
    if (d.selectedPatternId !== null && !d.patterns.some((p) => p.id === d.selectedPatternId))
      ctx.addIssue({ code: 'custom', message: '選択中の型が見つかりません' })
  })
export type RuleProfile = z.infer<typeof ruleSchema>
export type Pattern = z.infer<typeof patternSchema>
export type PlayerProfile = z.infer<typeof playerSchema>
export type BetLine = z.infer<typeof betSchema>
export type PayoutQuote = z.infer<typeof quoteSchema>
export type ManualBet = z.infer<typeof manualBetSchema>
export type RoundSnapshot = z.infer<typeof snapshotSchema>
export type Settlement = z.infer<typeof settlementSchema>
export type AppData = z.infer<typeof appDataSchema>
export type Style = z.infer<typeof styleSchema>
export type Weights = z.infer<typeof weightsSchema>
