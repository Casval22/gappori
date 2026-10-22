import type { BetLine, RuleProfile } from '../domain/schema'
import { fulfilled, outcomes, sum, type Outcome } from './outcomes'
export function fcRate(line: BetLine, rules: RuleProfile): number | null {
  if (!rules.fcEnabled || line.kind === 'round') return 0
  const p = line.kind === 'geta' ? rules.getaFc : rules.boatFc
  return p === null ? null : rules.fcTrial === 'line' ? p : 1 - (1 - p) ** line.quantity
}
export const fcRequirement = (r: number[], column: number | null, rules: RuleProfile) =>
  r.map((n, i) => (i === column ? (rules.fcEffect === 'all' ? 0 : Math.max(0, n - 1)) : n))
export interface Choice {
  column: number | null
  probability: number
  suspense: number
}
// Deliberately accepts ONLY the observed first three balls. The future is integrated out.
export function chooseFc(
  h: number[],
  requirement: number[],
  first: number[],
  rules: RuleProfile,
  remaining?: Outcome[],
): Choice {
  if (
    first.length !== h.length ||
    sum(first) !== 3 ||
    first.some((n, i) => !Number.isInteger(n) || n < 0 || n > h[i])
  )
    throw new Error('前半は実在するポケットから3球を指定してください')
  const later =
    remaining ??
    outcomes(
      h.map((n, i) => n - first[i]),
      2,
    )
  const conditional = (r: number[]) =>
    later.reduce(
      (p, o) =>
        p +
        (fulfilled(
          o.counts.map((n, i) => n + first[i]),
          r,
        )
          ? o.probability
          : 0),
      0,
    )
  let column: number | null = null,
    best = conditional(requirement)
  for (let i = 0; i < requirement.length; i++) {
    if (
      !requirement[i] ||
      (rules.fcEligible === 'unseen' ? first[i] !== 0 : first[i] >= requirement[i])
    )
      continue
    const p = conditional(fcRequirement(requirement, i, rules))
    if (p > best + 1e-12 || (column === null && Math.abs(p - best) < 1e-12)) {
      best = p
      column = i
    }
  }
  return { column, probability: best, suspense: 4 * best * (1 - best) }
}
export interface Stage {
  first: number[]
  later: Outcome[]
  probability: number
}
export const stages = (h: number[]): Stage[] =>
  outcomes(h, 3).map((o) => ({
    first: o.counts,
    probability: o.probability,
    later: outcomes(
      h.map((n, i) => n - o.counts[i]),
      2,
    ),
  }))
export function lineProbability(h: number[], line: BetLine, rules: RuleProfile) {
  let p = 0,
    suspense = 0
  const rate = fcRate(line, rules)
  for (const stage of stages(h)) {
    const base = stage.later.reduce(
      (a, o) =>
        a +
        (fulfilled(
          o.counts.map((n, i) => n + stage.first[i]),
          line.requirement,
        )
          ? o.probability
          : 0),
      0,
    )
    const withFc = rate
      ? chooseFc(h, line.requirement, stage.first, rules, stage.later).probability
      : base
    const q = base + (rate ?? 0) * (withFc - base)
    p += stage.probability * q
    suspense += stage.probability * 4 * q * (1 - q)
  }
  return { probability: p, suspense, fcUnknown: rate === null }
}
