import { useEffect, useState } from 'react'
import { api, type DashboardData, type ScoreData, type SimulateData, type StatusData } from './api'

/**
 * Live engine figures for the marketing surface.
 *
 * `source` is deliberately exposed and rendered on screen. If the API is down we
 * show the last verified figures and SAY SO rather than silently presenting
 * stale numbers as live ones — on a page whose entire argument is "our numbers
 * are computed, not claimed", quietly faking the fallback would be the one
 * unforgivable bug.
 */

export type Source = 'loading' | 'live' | 'offline'

/** Last values verified by `python seed.py` + `python verify.py`.
 *  Only ever rendered behind an explicit "engine offline" label. */
export const VERIFIED = {
  leakage_total: 46607.12,
  leakage_ratio: 0.041,
  closed_orders_analysed: 120,
  pipeline_value: 242350.99,
  open_quotes: 15,
  stalled_count: 1,
  band_counts: { AUTO: 7, MANAGER: 6, FINANCE: 2 } as Record<string, number>,
  simulate: {
    quotes_evaluated: 15, escalated: 4, elapsed_ms: 4.08, leakage_recovered: 846,
    band_counts_before: { AUTO: 7, MANAGER: 6, FINANCE: 2 } as Record<string, number>,
    band_counts_after: { AUTO: 4, MANAGER: 8, FINANCE: 3 } as Record<string, number>,
  },
  q1042: { score: 25.7, band: 'MANAGER', contributions: { S: 14.0, A: 6.23, L: 0.59, Z: 4.87 } },
  q1039: { score: 22.1, band: 'MANAGER', contributions: { S: 5.25, A: 15.37, L: 1.49, Z: 0.0 } },
  status: { real: 15, stub: 16, total: 31 },
  tests: 74,
}

export interface EngineState {
  source: Source
  dashboard: DashboardData | null
  status: StatusData | null
  simulate: SimulateData | null
  q1042: ScoreData | null
  q1039: ScoreData | null
}

const TIGHTEN_SERVICES = {
  category_ceiling: { Hardware: 15, Software: 15, Services: 8, Subscriptions: 12 },
}

export function useEngine(): EngineState {
  const [state, setState] = useState<EngineState>({
    source: 'loading', dashboard: null, status: null, simulate: null, q1042: null, q1039: null,
  })

  useEffect(() => {
    let alive = true
    Promise.all([
      api.dashboard(), api.status(), api.simulate(TIGHTEN_SERVICES),
      api.score('Q-1042'), api.score('Q-1039'),
    ])
      .then(([dashboard, status, simulate, q1042, q1039]) => {
        if (alive) setState({ source: 'live', dashboard, status, simulate, q1042, q1039 })
      })
      .catch(() => {
        if (alive) setState(s => ({ ...s, source: 'offline' }))
      })
    return () => { alive = false }
  }, [])

  return state
}
