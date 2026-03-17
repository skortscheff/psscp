import { useEffect, useState } from 'react'
import { jobsApi } from '../api/resources'
import type { Job } from '../api/types'

const TERMINAL_STATES = ['success', 'failed', 'cancelled']

export function useJob(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return

    let cancelled = false

    const poll = async () => {
      try {
        const j = await jobsApi.get(jobId)
        if (!cancelled) {
          setJob(j)
          if (!TERMINAL_STATES.includes(j.status)) {
            setTimeout(poll, 2000)
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unknown error')
        }
      }
    }

    poll()
    return () => { cancelled = true }
  }, [jobId])

  return { job, error }
}
