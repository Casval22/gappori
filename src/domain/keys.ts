import type { BetLine, Pattern, RuleProfile } from './schema'
export const columnLabel = (index: number) =>
  ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'][index] ?? '特殊'
export const kindLabel = (kind: BetLine['kind']) =>
  ({ geta: '下駄', boat: '舟', round: '丸皿' })[kind]
export const requirementLabel = (r: number[]) =>
  r.flatMap((n, i) => (n ? [`${columnLabel(i)}×${n}`] : [])).join('、')
export const patternKey = (p: Pattern) => `${p.total}/${p.special}/${p.counts.join(',')}`
// Complete rule values are intentionally retained, not a collision-prone abbreviated hash.
export const ruleKey = (r: RuleProfile) =>
  JSON.stringify({
    version: r.version,
    total: r.total,
    special: r.special,
    getaCost: r.getaCost,
    boatCost: r.boatCost,
    maxQuantity: r.maxQuantity,
    quantityStep: r.quantityStep,
    fcEnabled: r.fcEnabled,
    getaFc: r.getaFc,
    boatFc: r.boatFc,
    fcTrial: r.fcTrial,
    fcEffect: r.fcEffect,
    fcEligible: r.fcEligible,
  })
export const lineKey = (b: BetLine) => `${b.kind}:${b.requirement.join(',')}:${b.unitCost}`
export const compatible = (p: Pattern, r: RuleProfile) =>
  p.total === r.total && p.special === r.special
export const costOf = (lines: BetLine[]) => lines.reduce((s, b) => s + b.quantity * b.unitCost, 0)
export function normalizeLines(lines: BetLine[]): BetLine[] {
  const merged = new Map<string, BetLine>()
  for (const line of lines) {
    const key = `${line.kind}:${line.requirement.join(',')}`
    const old = merged.get(key)
    if (old && old.unitCost !== line.unitCost)
      throw new Error('同じBETに異なる単価は指定できません')
    merged.set(key, {
      ...line,
      requirement: [...line.requirement],
      quantity: line.quantity + (old?.quantity ?? 0),
    })
  }
  return [...merged.values()]
}
