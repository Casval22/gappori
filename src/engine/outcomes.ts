export interface Outcome {
  counts: number[]
  probability: number
}
export function choose(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < k) return 0
  let c = 1
  for (let i = 1; i <= Math.min(k, n - k); i++) c = (c * (n - i + 1)) / i
  return Math.round(c)
}
export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
export function outcomes(h: number[], balls: number): Outcome[] {
  const denominator = choose(sum(h), balls)
  if (!denominator) return []
  const result: Outcome[] = []
  const current = h.map(() => 0)
  function visit(i: number, remaining: number, weight: number) {
    if (i === h.length) {
      if (!remaining) result.push({ counts: [...current], probability: weight / denominator })
      return
    }
    for (let x = 0; x <= Math.min(h[i], remaining); x++) {
      current[i] = x
      visit(i + 1, remaining - x, weight * choose(h[i], x))
    }
  }
  visit(0, balls, 1)
  return result
}
export const fulfilled = (counts: number[], requirement: number[]) =>
  counts.length >= requirement.length && requirement.every((n, i) => counts[i] >= n)
export const probability = (h: number[], requirement: number[]) =>
  outcomes(h, 5).reduce((p, o) => p + (fulfilled(o.counts, requirement) ? o.probability : 0), 0)
export function requirements(columns: number, total: number): number[][] {
  const result: number[][] = [],
    r = Array<number>(columns).fill(0)
  function visit(i: number, rest: number) {
    if (i === columns - 1) {
      r[i] = rest
      result.push([...r])
      return
    }
    for (let n = 0; n <= rest; n++) {
      r[i] = n
      visit(i + 1, rest - n)
    }
  }
  visit(0, total)
  return result
}
export function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function draw(h: number[], balls: number, rng: () => number): number[] {
  const remaining = [...h],
    counts = h.map(() => 0)
  let total = sum(h)
  for (let b = 0; b < balls; b++) {
    let index = 0,
      target = rng() * total
    while (index < h.length - 1 && target >= remaining[index]) target -= remaining[index++]
    counts[index]++
    remaining[index]--
    total--
  }
  return counts
}
