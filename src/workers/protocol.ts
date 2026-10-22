import type { BetLine } from '../domain/schema'
import type { CalculationInput, CalculationResult } from '../engine/types'
import type { SimulationResult } from '../engine/simulation'
export interface Job {
  requestId: string
  roundId: string
  inputHash: string
  input: CalculationInput
  kind: 'calculate' | 'simulate'
  lines?: BetLine[][]
}
export interface Reply {
  requestId: string
  roundId: string
  inputHash: string
  result?: CalculationResult
  simulation?: SimulationResult
  error?: string
}
export const matchesJob = (job: Pick<Job, 'requestId' | 'roundId' | 'inputHash'>, reply: Reply) =>
  job.requestId === reply.requestId &&
  job.roundId === reply.roundId &&
  job.inputHash === reply.inputHash
