import { describe, it, expect } from 'vitest'
import { choose, outcomes, probability, draw, random, fulfilled } from './outcomes'
import { chooseFc, fcRate, fcRequirement, lineProbability, stages } from './freeChoice'
import { Evaluator } from './evaluation'
import { payout } from './payouts'
import { calculate, feasible, operationSeconds } from './optimizer'
import { simulate } from './simulation'
import { inputHash } from './types'
import { normalizeLines, ruleKey } from '../domain/keys'
import { input, geta, boat, quote } from '../test/fixtures'

describe('厳密な非復元抽選', () => {
  it('C(16,5)=4368 / 確率総和1', () => {
    expect(choose(16, 5)).toBe(4368)
    expect(choose(3, 5)).toBe(0)
    for (const h of [
      [1, 2, 3, 4, 5, 1],
      [1, 1, 1, 1, 2, 2, 3, 4, 1],
      [2, 2, 2, 0],
      [1, 19],
    ]) {
      expect(outcomes(h, 5).reduce((p, o) => p + o.probability, 0)).toBeCloseTo(1, 12)
      expect(
        stages(h).reduce(
          (p, s) => p + s.probability * s.later.reduce((v, z) => v + z.probability, 0),
          0,
        ),
      ).toBeCloseTo(1, 12)
    }
  })
  it.each([
    [boat.requirement, 240],
    [geta.requirement, 2030],
    [[0, 0, 0, 0, 5], 1],
  ])('指定された基準値 %j', (r, count) =>
    expect(probability([1, 2, 3, 4, 5, 1], r)).toBeCloseTo(count / 4368, 13),
  )
  it('物理ポケットの全組合せと集約状態が一致する', () => {
    const h = [1, 2, 2, 1],
      pockets = h.flatMap((n, i) => Array<number>(n).fill(i)),
      physical = new Map<string, number>()
    function visit(start: number, picked: number[]) {
      if (picked.length === 5) {
        const counts = h.map((_, i) => picked.filter((n) => n === i).length),
          key = counts.join(',')
        physical.set(key, (physical.get(key) ?? 0) + 1)
        return
      }
      for (let i = start; i < pockets.length; i++) visit(i + 1, [...picked, pockets[i]])
    }
    visit(0, [])
    for (const o of outcomes(h, 5))
      expect(o.probability).toBeCloseTo(physical.get(o.counts.join(','))! / choose(6, 5), 13)
    expect(outcomes(h, 5)).toHaveLength(physical.size)
  })
  it('不可能な要求は0、特殊も分母に含む', () => {
    expect(probability([1, 2, 3, 4, 5, 1], [2, 0, 0, 0, 3])).toBe(0)
    expect(probability([1, 2, 3, 4, 5, 0], boat.requirement)).not.toBeCloseTo(240 / 4368, 5)
  })
})
describe('共同抽選と数量', () => {
  it('同じBETは複数皿・2人でも独立式にならない', () => {
    const ctx = input(),
      p = probability([...ctx.pattern.counts, 1], geta.requirement)
    ctx.players.push({ ...ctx.players[0], id: 'p2' })
    const evaluator = new Evaluator(ctx)
    expect(evaluator.evaluate([[geta], [{ ...geta, quantity: 20 }]]).any).toBeCloseTo(p, 12)
    expect(evaluator.evaluate([[geta], [geta]]).all).toBeCloseTo(p, 12)
    expect(evaluator.evaluate([[geta]]).any).toBeCloseTo(p, 12)
  })
  it('同一行は統合しFC回数を増やさない', () => {
    const ctx = input()
    ctx.rules = { ...ctx.rules, fcEnabled: true, getaFc: 0.3 }
    const evaluator = new Evaluator(ctx)
    expect(normalizeLines([geta, geta])[0].quantity).toBe(2)
    expect(evaluator.evaluate([[geta, geta]]).any).toBeCloseTo(
      evaluator.evaluate([[{ ...geta, quantity: 2 }]]).any,
      12,
    )
  })
  it('FCなしの払出分布・期待純増は厳密', () => {
    const ctx = input()
    ctx.quotes = [quote(ctx, geta, 20)]
    ctx.players.push({ ...ctx.players[0], id: 'p2' })
    const e = new Evaluator(ctx).evaluate([[geta], [geta]])
    const p = 2030 / 4368
    expect(e.moneyAccuracy).toBe('exact')
    expect(e.money[0]!.expectedNet).toBeCloseTo(20 * p - 5, 12)
    expect(e.groupMoney!.distribution).toEqual(
      expect.arrayContaining([
        { net: -10, probability: expect.any(Number) },
        { net: 30, probability: expect.any(Number) },
      ]),
    )
    expect(e.groupMoney!.distribution).toHaveLength(2)
    expect(e.groupMoney!.profitProbability).toBeCloseTo(p, 12)
    expect(e.continueAll).toBeCloseTo(1, 12)
  })
  it('異なる当たりが重なる配当も状態ごとに合算する', () => {
    const ctx = input()
    ctx.quotes = [quote(ctx, geta, 20), quote(ctx, boat, 100)]
    const e = new Evaluator(ctx).evaluate([[geta, boat]])
    expect(e.money[0]!.expectedGross).toBeCloseTo((20 * 2030) / 4368 + (100 * 240) / 4368, 12)
    expect(e.any).toBeCloseTo(2030 / 4368, 12) // boat implies this geta
    expect(e.money[0]!.distribution.some((d) => d.net === 105)).toBe(true)
  })
})
describe('FCの段階的意思決定', () => {
  it('null / 0 / 1 / 数量ごとの集約を区別する', () => {
    const r = { ...input().rules, fcEnabled: true, getaFc: null }
    expect(fcRate(geta, r)).toBeNull()
    expect(fcRate(geta, { ...r, getaFc: 0 })).toBe(0)
    expect(fcRate(geta, { ...r, getaFc: 1 })).toBe(1)
    expect(fcRate({ ...geta, quantity: 3 }, { ...r, getaFc: 0.2, fcTrial: 'plate' })).toBeCloseTo(
      1 - 0.8 ** 3,
      14,
    )
    expect(fcRate({ ...geta, quantity: 3 }, { ...r, getaFc: 0.2, fcTrial: 'line' })).toBe(0.2)
  })
  it('前半だけの選択は条件付き全後半の最大値、同率は列番号順', () => {
    const r = { ...input().rules, fcEnabled: true, getaFc: 1 },
      h = [1, 2, 3, 4, 5, 1],
      requirement = [1, 1, 1, 0, 0]
    for (const s of stages(h)) {
      const possible = requirement.flatMap((n, i) => (n && s.first[i] === 0 ? [i] : []))
      const evaluate = (col: number | null) =>
        s.later.reduce(
          (p, z) =>
            p +
            (fulfilled(
              z.counts.map((n, i) => n + s.first[i]),
              fcRequirement(requirement, col, r),
            )
              ? z.probability
              : 0),
          0,
        )
      const choice = chooseFc(h, requirement, s.first, r),
        best = Math.max(evaluate(null), ...possible.map(evaluate))
      expect(choice.probability).toBeCloseTo(best, 12)
      const bestColumn = possible.find((i) => Math.abs(evaluate(i) - best) < 1e-12)
      expect(choice.column).toBe(bestColumn ?? null)
    }
  })
  it('未来の結果を見た上限より厳しくなる反例がある', () => {
    const r = { ...input().rules, fcEnabled: true, getaFc: 1, fcEligible: 'unfilled' as const },
      h = [1, 2, 3, 4, 5, 1],
      b = { ...geta, requirement: [1, 1, 1, 0, 0] }
    let oracle = 0
    for (const s of stages(h))
      for (const z of s.later) {
        const x = z.counts.map((n, i) => n + s.first[i])
        const success =
          fulfilled(x, b.requirement) ||
          b.requirement.some(
            (n, i) => n > s.first[i] && fulfilled(x, fcRequirement(b.requirement, i, r)),
          )
        if (success) oracle += s.probability * z.probability
      }
    expect(lineProbability(h, b, r).probability).toBeLessThan(oracle - 0.001)
  })
  it('効果量・選択可能列で結果が変わり、FCにより物理上不可能な要求も成立する', () => {
    const h = [1, 2, 3, 4, 5, 1],
      b = { ...geta, requirement: [3, 0, 0, 0, 0] },
      r = { ...input().rules, fcEnabled: true, getaFc: 1 }
    expect(lineProbability(h, b, r).probability).toBe(0)
    expect(lineProbability(h, b, { ...r, fcEffect: 'all' }).probability).toBeGreaterThan(0)
    expect(chooseFc(h, b.requirement, [1, 0, 0, 0, 2, 0], r).column).toBeNull()
    expect(
      chooseFc(h, b.requirement, [1, 0, 0, 0, 2, 0], { ...r, fcEligible: 'unfilled' }).column,
    ).toBe(0)
  })
  it('単一FC厳密値と共同評価が一致、FC収支推定はseed再現', () => {
    const ctx = input()
    ctx.rules = { ...ctx.rules, fcEnabled: true, getaFc: 0.35 }
    ctx.quotes = [quote(ctx, geta, 20)]
    const evaluator = new Evaluator(ctx),
      e = evaluator.evaluate([[geta]], true)
    expect(e.any).toBeCloseTo(
      lineProbability([...ctx.pattern.counts, 1], geta, ctx.rules).probability,
      12,
    )
    expect(e.moneyAccuracy).toBe('estimate')
    expect(evaluator.evaluate([[geta]], true)).toEqual(e)
    expect(e.money[0]!.profitProbability).toBeCloseTo(e.any, 1)
    expect(e.money[0]!.expectedGross).toBeCloseTo(e.any * 20, 12)
  })
})
describe('配当の適用範囲', () => {
  it('不明をゼロ扱いしない、確認済み0は既知', () => {
    const ctx = input()
    expect(payout(geta, ctx)).toBeNull()
    expect(new Evaluator(ctx).evaluate([[geta]]).money[0]).toBeNull()
    ctx.quotes = [quote(ctx, geta, 0)]
    expect(payout(geta, ctx)).toBe(0)
  })
  it('数量指定・型順・ルール・ラウンドを超えて流用しない', () => {
    const ctx = input()
    ctx.quotes = [quote(ctx, geta, 50, { scope: 'quantity', quantity: 2 })]
    expect(payout(geta, ctx)).toBeNull()
    expect(payout({ ...geta, quantity: 2 }, ctx)).toBe(50)
    expect(payout({ ...geta, quantity: 3 }, ctx)).toBeNull()
    expect(payout({ ...geta, quantity: 2 }, { ...ctx, roundId: 'next' })).toBeNull()
    expect(
      payout(
        { ...geta, quantity: 2 },
        { ...ctx, pattern: { ...ctx.pattern, counts: [2, 1, 3, 4, 5] } },
      ),
    ).toBeNull()
    expect(
      payout({ ...geta, quantity: 2 }, { ...ctx, rules: { ...ctx.rules, fcEffect: 'all' } }),
    ).toBeNull()
    expect(payout({ ...geta, requirement: [0, 1, 0, 1, 1], quantity: 2 }, ctx)).toBeNull()
  })
  it('架空値は明示的なデモ操作後だけ使う', () => {
    const ctx = input()
    ctx.quotes = [quote(ctx, geta, 1000, { source: 'demo' })]
    expect(payout(geta, ctx)).toBeNull()
    expect(payout(geta, { ...ctx, demo: true })).toBe(1000)
    expect(payout(boat, { ...ctx, demo: true })).toBe(120)
  })
})
describe('探索と制約', () => {
  it('全員の個人予算・数量・操作時間・行数を守る', () => {
    const ctx = input()
    ctx.players = Array.from({ length: 4 }, (_, i) => ({
      ...ctx.players[0],
      id: `p${i}`,
      budget: [5, 10, 15, 20][i],
    }))
    ctx.rules.maxSeconds = 8
    const result = calculate(ctx)
    expect(result.groups.length).toBeLessThanOrEqual(3)
    for (const g of result.groups)
      g.plans.forEach((p, i) => {
        expect(feasible(p.lines, ctx.players[i], ctx)).toBe(true)
        expect(operationSeconds(p.lines, ctx)).toBeLessThanOrEqual(8)
      })
    expect(result.probabilityAccuracy).toBe('exact')
    expect(result.searchAccuracy).toBe('heuristic')
  })
  it('購入不能をゼロ消費の最適戦略として扱わない', () => {
    const ctx = input()
    ctx.players[0].balance = 0
    expect(calculate(ctx).groups[0].plans[0].lines).toEqual([])
    expect(() => simulate(ctx, [[]])).toThrow()
  })
  it('配当入力済み候補内の最適化と、丸皿は登録分のみ', () => {
    const ctx = input()
    ctx.quotes = [quote(ctx, geta, 20)]
    const result = calculate(ctx)
    expect(result.groups[0].plans[0].money).not.toBeNull()
    expect(
      result.groups.flatMap((g) => g.plans.flatMap((p) => p.lines)).some((b) => b.kind === 'round'),
    ).toBe(false)
    expect(
      result.groups[0].plans[0].lines.every(
        (b) => b.requirement.join(',') === geta.requirement.join(','),
      ),
    ).toBe(true)
  })
  it('キャッシュ識別には全入力が含まれる', () => {
    const ctx = input(),
      base = inputHash(ctx)
    expect(inputHash({ ...ctx, roundId: 'next' })).not.toBe(base)
    expect(inputHash({ ...ctx, rules: { ...ctx.rules, getaFc: 0.3 } })).not.toBe(base)
    expect(inputHash({ ...ctx, players: [{ ...ctx.players[0], budget: 1 }] })).not.toBe(base)
    expect(inputHash({ ...ctx, quotes: [quote(ctx, geta)] })).not.toBe(base)
    expect(ruleKey(ctx.rules)).not.toBe(ruleKey({ ...ctx.rules, fcEligible: 'unfilled' }))
  })
})
describe('再現可能な推定・打切り', () => {
  it('物理抽選Monte Carloと小規模な厳密値が整合する', () => {
    const h = [1, 2, 2, 1],
      r = [1, 1, 1],
      rng = random(10)
    let hits = 0
    for (let i = 0; i < 30000; i++) if (fulfilled(draw(h, 5, rng), r)) hits++
    expect(Math.abs(hits / 30000 - probability(h, r))).toBeLessThan(0.015)
  })
  it('不明配当ではシミュレーションしない', () =>
    expect(() => simulate(input(), [[geta]])).toThrow())
  it('ゼロ配当なら残高で決まる停止・中央値・継続確率', () => {
    const ctx = input()
    ctx.rules = { ...ctx.rules, trials: 100, horizon: 20, continuationK: 5 }
    ctx.players[0].balance = 20
    ctx.quotes = [quote(ctx, geta, 0)]
    const s = simulate(ctx, [[geta]])
    expect(s.firstStop.mean).toBe(4)
    expect(s.firstStop.median).toBe(4)
    expect(s.firstStop.surviveK).toBe(0)
    expect(s.firstStop.censored).toBe(0)
    expect(s.minutes).toBeNull()
  })
  it('全員に共通の抽選を適用、最初と最後の停止を区別し、打切りを数える', () => {
    const ctx = input()
    ctx.rules = { ...ctx.rules, trials: 100, horizon: 3, continuationK: 2 }
    ctx.players[0].balance = 5
    ctx.players.push({ ...ctx.players[0], id: 'p2', balance: 30 })
    ctx.quotes = [quote(ctx, geta, 0)]
    const s = simulate(ctx, [[geta], [geta]])
    expect(s.firstStop.mean).toBe(1)
    expect(s.lastStop.mean).toBe(3)
    expect(s.lastStop.censored).toBe(100)
    ctx.players[0].balance = 30
    ctx.quotes = [quote(ctx, geta, 20)]
    const identical = simulate(ctx, [[geta], [geta]])
    expect(identical.firstStop).toEqual(identical.lastStop)
    expect(simulate(ctx, [[geta], [geta]])).toEqual(identical)
  })
})
describe('上限と境界のモデル', () => {
  it('20ポケット・8列・4人・FCありでも計算を完了し、個人制約を守る', () => {
    const ctx = input()
    ctx.pattern = { ...ctx.pattern, total: 20, counts: [1, 1, 2, 2, 2, 3, 4, 4] }
    ctx.rules = {
      ...ctx.rules,
      total: 20,
      fcEnabled: true,
      getaFc: 0.35,
      boatFc: 0.2,
      fcTrial: 'plate',
      fcEffect: 'all',
      maxLines: 3,
    }
    ctx.players = Array.from({ length: 4 }, (_, i) => ({ ...ctx.players[0], id: `p${i}` }))
    const result = calculate(ctx)
    expect(result.groups).toHaveLength(3)
    expect(result.screened).toBeLessThanOrEqual(36)
    for (const group of result.groups) {
      group.plans.forEach((plan, i) => expect(feasible(plan.lines, ctx.players[i], ctx)).toBe(true))
      expect(group.evaluation.any).toBeGreaterThanOrEqual(group.evaluation.all)
    }
  }, 30000)
  it('総6・通常1列・特殊5でも全確率とFC付与が整合する', () => {
    const ctx = input()
    ctx.pattern = { ...ctx.pattern, total: 6, special: 5, counts: [1] }
    ctx.rules = {
      ...ctx.rules,
      total: 6,
      special: 5,
      fcEnabled: true,
      getaFc: 1,
      boatFc: 1,
      fcEffect: 'all',
    }
    const b = { ...geta, requirement: [3] }
    expect(lineProbability([1, 5], b, ctx.rules).probability).toBeCloseTo(0.5, 12)
    expect(calculate(ctx).groups[0].evaluation.any).toBeCloseTo(0.5, 12)
  })
  it('FCありの次回継続確率も共通結果を積分する', () => {
    const ctx = input()
    ctx.rules = { ...ctx.rules, fcEnabled: true, getaFc: 0.3 }
    ctx.players[0].balance = 5
    ctx.quotes = [quote(ctx, geta, 5)]
    ctx.players.push({ ...ctx.players[0], id: 'p2' })
    const result = new Evaluator(ctx).evaluate([[geta], [geta]], true)
    expect(result.continueAll).toBeCloseTo(result.all, 12)
    expect(result.all).toBeGreaterThan(result.any ** 2 * 0.5)
  })
})
