import type { BetLine } from '../domain/schema'
import { costOf, lineKey, normalizeLines } from '../domain/keys'
import { chooseFc, fcRate, fcRequirement } from './freeChoice'
import { draw, fulfilled, random } from './outcomes'
import { payout } from './payouts'
import type { CalculationInput } from './types'
export interface Lifetime {
  mean: number
  median: number
  surviveK: number
  earlyStop: number
  censored: number
  interval: [number, number]
}
export interface SimulationResult {
  firstStop: Lifetime
  lastStop: Lifetime
  trials: number
  horizon: number
  k: number
  seed: number
  minutes: number | null
}
export function wilson(hits: number, trials: number): [number, number] {
  const p = hits / trials,
    z = 1.96,
    d = 1 + (z * z) / trials,
    center = (p + (z * z) / (2 * trials)) / d,
    half = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / d
  return [Math.max(0, center - half), Math.min(1, center + half)]
}
export function simulate(input: CalculationInput, portfolios: BetLine[][]): SimulationResult {
  const lines = portfolios.map(normalizeLines),
    rules = input.rules,
    costs = lines.map(costOf)
  const payouts = lines.map((ls) => ls.map((b) => payout(b, input)))
  if (costs.some((c) => c <= 0) || payouts.some((q) => q.some((v) => v === null)))
    throw new Error('持続性には全員の購入BETと今回の配当が必要です')
  const h = [...input.pattern.counts, rules.special],
    rng = random(rules.seed),
    choiceCache = new Map<string, number | null>()
  const first: number[] = [],
    last: number[] = []
  for (let trial = 0; trial < rules.trials; trial++) {
    const balances = input.players.map((p) => p.balance),
      played = lines.map(() => 0)
    for (let round = 0; round < rules.horizon; round++) {
      const active = balances.map((v, i) => v >= costs[i] && played[i] === round)
      if (!active.some(Boolean)) break
      const y = draw(h, 3, rng),
        z = draw(
          h.map((n, i) => n - y[i]),
          2,
          rng,
        ),
        x = y.map((n, i) => n + z[i])
      lines.forEach((ls, i) => {
        if (!active[i]) return
        balances[i] -= costs[i]
        played[i]++
        ls.forEach((b, j) => {
          let r = b.requirement
          if (rng() < (fcRate(b, rules) ?? 0)) {
            const key = `${lineKey(b)}:${y.join(',')}`
            if (!choiceCache.has(key))
              choiceCache.set(key, chooseFc(h, b.requirement, y, rules).column)
            r = fcRequirement(r, choiceCache.get(key)!, rules)
          }
          if (fulfilled(x, r)) balances[i] += payouts[i][j]!
        })
      })
    }
    first.push(Math.min(...played))
    last.push(Math.max(...played))
  }
  const summarize = (values: number[]): Lifetime => {
    values.sort((a, b) => a - b)
    const survive = values.filter((n) => n >= rules.continuationK).length
    return {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median:
        (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2,
      surviveK: survive / values.length,
      earlyStop: 1 - survive / values.length,
      censored: values.filter((n) => n >= rules.horizon).length,
      interval: wilson(survive, values.length),
    }
  }
  const firstStop = summarize(first)
  return {
    firstStop,
    lastStop: summarize(last),
    trials: rules.trials,
    horizon: rules.horizon,
    k: rules.continuationK,
    seed: rules.seed,
    minutes: rules.roundSeconds === null ? null : (firstStop.mean * rules.roundSeconds) / 60,
  }
}
