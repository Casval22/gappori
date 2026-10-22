import type { BetLine, PlayerProfile, Weights } from '../domain/schema'
import { compatible, costOf, lineKey, normalizeLines, patternKey, ruleKey } from '../domain/keys'
import { presets } from '../domain/defaults'
import { fulfilled, outcomes, requirements } from './outcomes'
import { fcRate } from './freeChoice'
import { payout } from './payouts'
import { Evaluator } from './evaluation'
import {
  inputHash,
  type CalculationInput,
  type CalculationResult,
  type GroupPlan,
  type Plan,
} from './types'

export const operationSeconds = (lines: BetLine[], input: CalculationInput) =>
  lines.reduce(
    (n, b) =>
      n +
      1 +
      b.requirement.filter(Boolean).length +
      (b.quantity > input.rules.quantityStep ? 1 : 0),
    0,
  ) * input.rules.secondsPerTap
export function feasible(lines: BetLine[], player: PlayerProfile, input: CalculationInput) {
  const normalized = normalizeLines(lines),
    r = input.rules,
    cost = costOf(normalized)
  return (
    normalized.length > 0 &&
    normalized.length <= r.maxLines &&
    normalized.every((b) => b.quantity <= r.maxQuantity && b.quantity % r.quantityStep === 0) &&
    cost <= Math.min(player.balance, player.budget) &&
    (r.maxSeconds === null || operationSeconds(normalized, input) <= r.maxSeconds)
  )
}
const planKey = (lines: BetLine[]) =>
  lines
    .map((b) => `${lineKey(b)}:${b.quantity}`)
    .sort()
    .join('|')
function combinedWeights(a: Weights, b: Weights): Weights {
  return Object.fromEntries(
    Object.entries(a).map(([key, value]) => [key, (value + b[key as keyof Weights]) / 2]),
  ) as Weights
}
export function calculate(input: CalculationInput): CalculationResult {
  const started = performance.now(),
    r = input.rules,
    pattern = input.pattern
  if (!compatible(pattern, r)) throw new Error('現在のルールと型の合計が一致しません')
  const h = [...pattern.counts, r.special],
    baseOutcomes = outcomes(h, 5)
  const candidates: { line: BetLine; base: number; optimistic: number; quoted: boolean }[] = []
  for (const kind of ['geta', 'boat'] as const) {
    for (const requirement of requirements(pattern.counts.length, kind === 'geta' ? 3 : 5)) {
      const line = {
        kind,
        requirement,
        quantity: r.quantityStep,
        unitCost: kind === 'geta' ? r.getaCost : r.boatCost,
      }
      const fc = (fcRate(line, r) ?? 0) > 0
      if (!fc && requirement.some((n, i) => n > pattern.counts[i])) continue
      let base = 0,
        optimistic = 0
      for (const o of baseOutcomes) {
        if (fulfilled(o.counts, requirement)) {
          base += o.probability
          optimistic += o.probability
        } else if (fc) {
          const deficits = requirement.map((n, i) => Math.max(0, n - o.counts[i]))
          if (
            r.fcEffect === 'one'
              ? deficits.reduce((a, b) => a + b, 0) <= 1
              : deficits.filter(Boolean).length <= 1
          )
            optimistic += o.probability
        }
      }
      if (optimistic || base)
        candidates.push({
          line,
          base,
          optimistic,
          quoted: input.quotes.some(
            (q) =>
              q.roundId === input.roundId &&
              q.patternKey === patternKey(pattern) &&
              q.ruleKey === ruleKey(r) &&
              q.kind === kind &&
              q.requirement.join(',') === requirement.join(',') &&
              (input.demo || q.source === 'manual'),
          ),
        })
    }
  }
  const manual = input.manualBets.filter(
    (b) =>
      b.patternKey === patternKey(pattern) &&
      b.ruleKey === ruleKey(r) &&
      b.roundId === input.roundId,
  )
  for (const b of manual)
    candidates.push({
      line: b.line,
      base: 0,
      optimistic: 1,
      quoted: payout(b.line, input) !== null,
    })
  // Keep quoted, likely, FC-reachable and dissimilar requirements in a bounded pool.
  const pool = new Map<string, BetLine>()
  const add = (line: BetLine) => {
    if (pool.size < 36) pool.set(lineKey(line), line)
  }
  candidates
    .filter((c) => c.quoted)
    .slice(0, 16)
    .forEach((c) => add(c.line))
  ;[...candidates]
    .sort((a, b) => b.base - a.base)
    .slice(0, 12)
    .forEach((c) => add(c.line))
  ;[...candidates]
    .sort((a, b) => b.optimistic - a.optimistic)
    .slice(0, 10)
    .forEach((c) => add(c.line))
  for (let col = 0; col < pattern.counts.length; col++) {
    const candidate = [...candidates].sort(
      (a, b) => b.line.requirement[col] - a.line.requirement[col] || b.optimistic - a.optimistic,
    )[0]
    if (candidate) add(candidate.line)
  }
  for (const c of candidates) add(c.line)
  const evaluator = new Evaluator(input)
  let evaluated = 0
  const options = input.players.map((player, playerIndex) => {
    const weights = combinedWeights(r.weights, presets[player.preference])
    const evaluate = (lines: BetLine[]): Plan => {
      evaluated++
      const e = evaluator.evaluate([lines]),
        cost = costOf(lines),
        seconds = operationSeconds(lines, input)
      const quotes = lines.map((b) => payout(b, input)),
        known = quotes.every((q) => q !== null)
      const expected = known
        ? lines.reduce((v, b, i) => v + evaluator.single(b) * quotes[i]!, 0) - cost
        : 0
      const probability = e.any,
        suspense = lines.reduce((v, b) => v + evaluator.suspense(b), 0) / lines.length
      const jackpot = known
        ? Math.min(
            1,
            lines.reduce(
              (v, b, i) => v + (quotes[i]! - cost >= r.jackpotThreshold ? evaluator.single(b) : 0),
              0,
            ),
          )
        : 0
      const score =
        weights.frequency * probability +
        weights.profit * (known ? Math.tanh(expected / Math.max(1, cost)) : 0) +
        weights.thrill * suspense +
        weights.jackpot * jackpot +
        weights.economy * (1 - cost / Math.max(1, Math.min(player.balance, player.budget))) -
        weights.operations * Math.min(1, seconds / (r.maxSeconds ?? 30))
      return { lines, cost, seconds, probability, suspense, score, money: e.money[0] }
    }
    const singles: Plan[] = []
    for (const line of pool.values()) {
      const max = Math.min(
        r.maxQuantity,
        Math.floor(Math.min(player.balance, player.budget) / line.unitCost),
      )
      const quantities = new Set([
        r.quantityStep,
        2 * r.quantityStep,
        5 * r.quantityStep,
        Math.floor(max / r.quantityStep) * r.quantityStep,
        ...input.quotes
          .filter(
            (q) =>
              q.scope === 'quantity' &&
              q.kind === line.kind &&
              q.requirement.join(',') === line.requirement.join(','),
          )
          .map((q) => q.quantity),
      ])
      for (const quantity of quantities) {
        const b = { ...line, quantity }
        if (quantity > 0 && feasible([b], player, input)) singles.push(evaluate([b]))
      }
    }
    const quotedSingles = singles.filter((p) => p.lines.every((b) => payout(b, input) !== null))
    // Monetary ranking is confined to candidates with all quotations known.
    const basis = quotedSingles.length ? quotedSingles : singles
    basis.sort((a, b) => b.score - a.score || a.cost - b.cost)
    let beam = basis.slice(0, 8)
    const all = [...beam]
    const extensions = basis.slice(0, 18)
    // Include coverage alternatives even when their individual score is lower.
    for (const single of basis.slice(18)) {
      if (extensions.length >= 24) break
      if (
        !extensions.some(
          (p) => p.lines[0].requirement.join(',') === single.lines[0].requirement.join(','),
        )
      )
        extensions.push(single)
    }
    for (let depth = 2; depth <= r.maxLines; depth++) {
      const next = new Map<string, Plan>()
      for (const p of beam)
        for (const single of extensions) {
          if (p.lines.some((b) => lineKey(b) === lineKey(single.lines[0]))) continue
          const lines = [...p.lines, single.lines[0]]
          if (!feasible(lines, player, input)) continue
          const key = planKey(lines)
          if (!next.has(key)) next.set(key, evaluate(lines))
        }
      beam = [...next.values()].sort((a, b) => b.score - a.score).slice(0, 8)
      all.push(...beam)
    }
    all.sort((a, b) => b.score - a.score)
    // Three individual finalists, keeping different requirement coverage where possible.
    const finalists: Plan[] = []
    const seen = new Set<string>()
    for (const plan of all) {
      const key = plan.lines
        .map((b) => lineKey(b))
        .sort()
        .join('|')
      if (!seen.has(key)) {
        seen.add(key)
        finalists.push(plan)
      }
      if (finalists.length === 3) break
    }
    if (!finalists.length)
      return [
        { lines: [], cost: 0, seconds: 0, probability: 0, suspense: 0, score: -10, money: null },
      ]
    // Keep correct player reference for detailed one-player results.
    const personal = new Evaluator({ ...input, players: [input.players[playerIndex]] })
    return finalists.map((p) => ({ ...p, money: personal.evaluate([p.lines], true).money[0] }))
  })
  const groups: GroupPlan[] = []
  function visit(index: number, plans: Plan[]) {
    if (index < options.length) {
      for (const p of options[index]) visit(index + 1, [...plans, p])
      return
    }
    const evaluation = evaluator.evaluate(
      plans.map((p) => p.lines),
      false,
    )
    const groupFeature =
      r.groupGoal === 'all'
        ? evaluation.all
        : r.groupGoal === 'continue'
          ? (evaluation.continueAll ?? evaluation.all)
          : evaluation.any
    groups.push({
      plans,
      evaluation,
      score: plans.reduce((v, p) => v + p.score, 0) / plans.length + r.weights.group * groupFeature,
    })
  }
  visit(0, [])
  groups.sort((a, b) => b.score - a.score)
  const best = groups.slice(0, 3).map((g) => {
    const evaluation = evaluator.evaluate(
      g.plans.map((p) => p.lines),
      true,
    )
    return {
      ...g,
      evaluation,
      plans: g.plans.map((p, i) => ({ ...p, money: evaluation.money[i] })),
    }
  })
  const warnings = [
    '均等・非復元の仮定モデル内の厳密確率。実機の実測値ではありません。',
    '特殊抽選・JP・スタンプ・漁は計算対象外です。',
  ]
  if (r.fcEnabled && (r.getaFc === null || r.boatFc === null))
    warnings.push('FC未設定の皿種はFCを除外し、基準確率を表示しています。')
  if (!r.fcEnabled) warnings.push('FCを除外した基準モデルです。')
  if (r.fcEnabled) warnings.push('FCは各行最大1個。行間・プレイヤー間で独立に獲得する仮説です。')
  if (best.some((g) => g.evaluation.money.some((m) => m === null)))
    warnings.push('配当不明：確率ベースの候補です。期待収支・持続回数は算出しません。')
  if (r.groupGoal === 'continue' && best.some((g) => g.evaluation.continueAll === null))
    warnings.push('配当不足のため「全員が続ける」は全員成立確率を代理指標にしています。')
  return {
    inputHash: inputHash(input),
    roundId: input.roundId,
    groups: best,
    candidates: candidates.length,
    screened: pool.size,
    evaluated,
    elapsedMs: performance.now() - started,
    probabilityAccuracy: 'exact',
    searchAccuracy: 'heuristic',
    warnings,
  }
}
