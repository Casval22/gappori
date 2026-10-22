import { useEffect, useRef, useState } from 'react'
import { uid } from '../domain/defaults'
import type { BetLine } from '../domain/schema'
import { inputHash, type CalculationInput } from '../engine/types'
import { matchesJob, type Job, type Reply } from './protocol'
export function useCalculation(
  input: CalculationInput | null,
  kind: Job['kind'] = 'calculate',
  lines?: BetLine[][],
) {
  const [reply, setReply] = useState<Reply | null>(null)
  const [cancelledHash, setCancelledHash] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const hash = input ? inputHash(input) : null
  const linesKey = JSON.stringify(lines)
  const jobKey = `${hash}:${kind}:${linesKey}`
  useEffect(() => {
    if (!hash || cancelledHash === jobKey) return
    const input: CalculationInput = JSON.parse(hash)
    const job: Job = {
      requestId: uid(),
      roundId: input.roundId,
      inputHash: jobKey,
      input,
      kind,
      lines: linesKey ? JSON.parse(linesKey) : undefined,
    }
    let active = true
    const worker = new Worker(new URL('./calculation.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<Reply>) => {
      if (active && matchesJob(job, event.data)) setReply(event.data)
    }
    worker.onerror = () => {
      if (active)
        setReply({
          requestId: job.requestId,
          roundId: job.roundId,
          inputHash: jobKey,
          error: '計算Workerを起動できません。再読み込みしてください。',
        })
    }
    worker.postMessage(job)
    return () => {
      active = false
      worker.terminate()
      workerRef.current = null
    }
  }, [hash, kind, linesKey, jobKey, cancelledHash])
  const current = reply?.inputHash === jobKey && reply.roundId === input?.roundId ? reply : null
  return {
    reply: current,
    busy: !!input && !current && cancelledHash !== jobKey,
    cancelled: cancelledHash === jobKey,
    cancel: () => {
      workerRef.current?.terminate()
      setCancelledHash(jobKey)
    },
    retry: () => setCancelledHash(null),
  }
}
