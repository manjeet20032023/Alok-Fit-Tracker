export interface StopwatchState {
  startedAt: string
  pausedAt?: string | null
  totalPausedSeconds: number
  completedAt?: string | null
  durationSeconds?: number | null
  status: 'in_progress' | 'paused' | 'completed' | 'abandoned'
}

function timestamp(value?: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function calculateElapsedSeconds(state: StopwatchState, now: Date = new Date()): number {
  const started = timestamp(state.startedAt)
  if (started === null) return 0

  if (state.status === 'completed') {
    const completed = timestamp(state.completedAt)
    if (completed === null) return 0
    return Math.max(0, Math.floor((completed - started) / 1000) - state.totalPausedSeconds)
  }

  const end = state.status === 'paused'
    ? timestamp(state.pausedAt) ?? Date.now()
    : now.getTime()
  return Math.max(0, Math.floor((end - started) / 1000) - state.totalPausedSeconds)
}

export function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':')
}
