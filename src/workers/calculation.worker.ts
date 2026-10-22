/// <reference lib="webworker" />
import { calculate } from '../engine/optimizer'
import { simulate } from '../engine/simulation'
import type { Job, Reply } from './protocol'
self.onmessage = (event: MessageEvent<Job>) => {
  const job = event.data,
    reply: Reply = { requestId: job.requestId, roundId: job.roundId, inputHash: job.inputHash }
  try {
    if (job.kind === 'simulate') reply.simulation = simulate(job.input, job.lines ?? [])
    else reply.result = calculate(job.input)
  } catch (error) {
    reply.error = error instanceof Error ? error.message : '計算に失敗しました'
  }
  self.postMessage(reply)
}
