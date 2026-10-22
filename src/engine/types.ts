import type {
  BetLine,
  ManualBet,
  Pattern,
  PlayerProfile,
  PayoutQuote,
  RuleProfile,
  Style,
} from '../domain/schema'
export interface CalculationInput {
  pattern: Pattern
  rules: RuleProfile
  players: PlayerProfile[]
  quotes: PayoutQuote[]
  manualBets: ManualBet[]
  roundId: string
  style: Style
  demo: boolean
}
export interface MoneyMetrics {
  expectedGross: number
  expectedNet: number
  profitProbability: number
  lossProbability: number
  jackpotProbability: number
  distribution: { net: number; probability: number }[]
}
export interface Evaluation {
  playerProbability: number[]
  any: number
  all: number
  continueAll: number | null
  money: (MoneyMetrics | null)[]
  groupMoney: MoneyMetrics | null
  moneyAccuracy: 'exact' | 'estimate' | 'unknown'
  samples: number
  probabilityError: number | null
}
export interface Plan {
  lines: BetLine[]
  probability: number
  cost: number
  seconds: number
  score: number
  money: MoneyMetrics | null
  suspense: number
}
export interface GroupPlan {
  plans: Plan[]
  evaluation: Evaluation
  score: number
}
export interface CalculationResult {
  inputHash: string
  roundId: string
  groups: GroupPlan[]
  candidates: number
  screened: number
  evaluated: number
  elapsedMs: number
  probabilityAccuracy: 'exact'
  searchAccuracy: 'heuristic'
  warnings: string[]
}
export const inputHash = (input: CalculationInput) => JSON.stringify(input)
