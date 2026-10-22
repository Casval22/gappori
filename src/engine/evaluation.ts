import type { BetLine } from '../domain/schema'
import { costOf, lineKey, normalizeLines } from '../domain/keys'
import { outcomes, fulfilled, random } from './outcomes'
import { chooseFc, fcRate, fcRequirement, stages } from './freeChoice'
import { payout } from './payouts'
import type { CalculationInput, Evaluation, MoneyMetrics } from './types'

interface JointState {
  probability: number
  first: number[]
  counts: number[]
}
export class Evaluator {
  readonly states: JointState[]
  readonly hasFc: boolean
  private cache = new Map<string, Float64Array>()
  private suspenseCache = new Map<string, number>()
  constructor(readonly input: CalculationInput) {
    const h = [...input.pattern.counts, input.rules.special]
    this.hasFc =
      input.rules.fcEnabled && ((input.rules.getaFc ?? 0) > 0 || (input.rules.boatFc ?? 0) > 0)
    this.states = this.hasFc
      ? stages(h).flatMap((s) =>
          s.later.map((o) => ({
            first: s.first,
            counts: o.counts.map((n, i) => n + s.first[i]),
            probability: s.probability * o.probability,
          })),
        )
      : outcomes(h, 5).map((o) => ({ ...o, first: [] }))
  }
  probabilities(line: BetLine): Float64Array {
    const key = `${lineKey(line)}:${line.quantity}`
    const cached = this.cache.get(key)
    if (cached) return cached
    const h = [...this.input.pattern.counts, this.input.rules.special],
      rules = this.input.rules
    const rate = fcRate(line, rules) ?? 0,
      choices = new Map<string, number[]>()
    const values = Float64Array.from(this.states, (s) => {
      if (fulfilled(s.counts, line.requirement)) return 1
      if (!rate) return 0
      const firstKey = s.first.join(',')
      let adjusted = choices.get(firstKey)
      if (!adjusted) {
        adjusted = fcRequirement(
          line.requirement,
          chooseFc(h, line.requirement, s.first, rules).column,
          rules,
        )
        choices.set(firstKey, adjusted)
      }
      return fulfilled(s.counts, adjusted) ? rate : 0
    })
    this.cache.set(key, values)
    return values
  }
  single(line: BetLine) {
    return this.probabilities(line).reduce((p, v, i) => p + v * this.states[i].probability, 0)
  }
  suspense(line: BetLine) {
    const key = `${lineKey(line)}:${line.quantity}`
    const cached = this.suspenseCache.get(key)
    if (cached !== undefined) return cached
    const h = [...this.input.pattern.counts, this.input.rules.special],
      rate = fcRate(line, this.input.rules) ?? 0
    let result = 0
    for (const s of stages(h)) {
      const base = s.later.reduce(
        (a, o) =>
          a +
          (fulfilled(
            o.counts.map((n, i) => n + s.first[i]),
            line.requirement,
          )
            ? o.probability
            : 0),
        0,
      )
      const q = rate
        ? base +
          rate *
            (chooseFc(h, line.requirement, s.first, this.input.rules, s.later).probability - base)
        : base
      result += s.probability * 4 * q * (1 - q)
    }
    this.suspenseCache.set(key, result)
    return result
  }
  evaluate(portfolios: BetLine[][], detailed = false): Evaluation {
    const lines = portfolios.map(normalizeLines),
      costs = lines.map(costOf)
    const ps = lines.map((ls) => ls.map((b) => this.probabilities(b)))
    const payouts = lines.map((ls) => ls.map((b) => payout(b, this.input)))
    const known = payouts.map((qs, i) => lines[i].length > 0 && qs.every((q) => q !== null))
    const pp = lines.map(() => 0),
      expectedGross = lines.map(() => 0)
    let any = 0,
      all = 0,
      continuation = 0
    const maps = lines.map(() => new Map<number, number>()),
      groupMap = new Map<number, number>()
    const add = (nets: number[], weight: number) => {
      nets.forEach((net, i) => {
        if (known[i]) maps[i].set(net, (maps[i].get(net) ?? 0) + weight)
      })
      if (known.every(Boolean)) {
        const net = nets.reduce((a, b) => a + b, 0)
        groupMap.set(net, (groupMap.get(net) ?? 0) + weight)
      }
    }
    this.states.forEach((s, si) => {
      const chances = ps.map((ls) => 1 - ls.reduce((miss, values) => miss * (1 - values[si]), 1))
      chances.forEach((p, i) => {
        pp[i] += s.probability * p
      })
      any += s.probability * (1 - chances.reduce((miss, p) => miss * (1 - p), 1))
      all += s.probability * chances.reduce((hit, p) => hit * p, 1)
      const gross = ps.map((ls, i) =>
        ls.reduce((v, values, j) => v + values[si] * (payouts[i][j] ?? 0), 0),
      )
      gross.forEach((g, i) => {
        expectedGross[i] += s.probability * g
      })
      if (known.every(Boolean)) {
        const survive = ps.map((ls, i) => {
          let possibilities: [number, number][] = [[0, 1]]
          ls.forEach((values, j) => {
            possibilities = possibilities
              .flatMap(
                ([g, p]) =>
                  [
                    [g, p * (1 - values[si])],
                    [g + payouts[i][j]!, p * values[si]],
                  ] as [number, number][],
              )
              .filter(([, p]) => p > 0)
          })
          return possibilities.reduce(
            (v, [g, p]) => v + (this.input.players[i].balance - costs[i] + g >= costs[i] ? p : 0),
            0,
          )
        })
        continuation += s.probability * survive.reduce((a, b) => a * b, 1)
      }
      if (!this.hasFc)
        add(
          gross.map((g, i) => g - costs[i]),
          s.probability,
        )
    })
    let samples = 0
    if (this.hasFc && detailed && known.some(Boolean)) {
      samples = 12000
      const rng = random(this.input.rules.seed),
        cdf: number[] = []
      this.states.reduce((v, s) => {
        cdf.push(v + s.probability)
        return v + s.probability
      }, 0)
      for (let trial = 0; trial < samples; trial++) {
        const target = rng()
        let lo = 0,
          hi = cdf.length - 1
        while (lo < hi) {
          const mid = (lo + hi) >>> 1
          if (cdf[mid] < target) lo = mid + 1
          else hi = mid
        }
        const gross = ps.map((ls, i) =>
          ls.reduce((g, values, j) => g + (rng() < values[lo] ? (payouts[i][j] ?? 0) : 0), 0),
        )
        add(
          gross.map((g, i) => g - costs[i]),
          1 / samples,
        )
      }
    }
    const metrics = (map: Map<number, number>, gross: number, cost: number): MoneyMetrics => ({
      expectedGross: gross,
      expectedNet: gross - cost,
      profitProbability: [...map].reduce((p, [n, v]) => p + (n > 0 ? v : 0), 0),
      lossProbability: [...map].reduce((p, [n, v]) => p + (n < 0 ? v : 0), 0),
      jackpotProbability: [...map].reduce(
        (p, [n, v]) => p + (n >= this.input.rules.jackpotThreshold ? v : 0),
        0,
      ),
      distribution: [...map]
        .sort(([a], [b]) => a - b)
        .map(([net, probability]) => ({ net, probability })),
    })
    const canMoney = !this.hasFc || detailed
    return {
      playerProbability: pp,
      any,
      all,
      continueAll: known.every(Boolean) ? continuation : null,
      money: maps.map((m, i) =>
        known[i] && canMoney ? metrics(m, expectedGross[i], costs[i]) : null,
      ),
      groupMoney:
        known.every(Boolean) && canMoney
          ? metrics(
              groupMap,
              expectedGross.reduce((a, b) => a + b, 0),
              costs.reduce((a, b) => a + b, 0),
            )
          : null,
      moneyAccuracy: known.some(Boolean) ? (this.hasFc ? 'estimate' : 'exact') : 'unknown',
      samples,
      probabilityError: samples ? (1.96 * 0.5) / Math.sqrt(samples) : null,
    }
  }
}
