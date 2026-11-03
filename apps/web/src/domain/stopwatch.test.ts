import { describe, expect, it } from 'vitest'
import { calculateElapsedSeconds, formatElapsed } from './stopwatch'

const start = '2026-11-03T06:00:00.000Z'

describe('workout stopwatch', () => {
  it('includes rest time while in progress', () => {
    expect(calculateElapsedSeconds({ startedAt: start, totalPausedSeconds: 0, status: 'in_progress' }, new Date('2026-11-03T06:30:00.000Z'))).toBe(1800)
  })

  it('excludes accumulated pause time', () => {
    expect(calculateElapsedSeconds({ startedAt: start, totalPausedSeconds: 120, status: 'in_progress' }, new Date('2026-11-03T06:30:00.000Z'))).toBe(1680)
  })

  it('does not advance while paused', () => {
    expect(calculateElapsedSeconds({ startedAt: start, pausedAt: '2026-11-03T06:10:00.000Z', totalPausedSeconds: 0, status: 'paused' }, new Date('2026-11-03T07:00:00.000Z'))).toBe(600)
  })

  it('uses completed timestamps and excludes paused duration', () => {
    expect(calculateElapsedSeconds({ startedAt: start, pausedAt: null, totalPausedSeconds: 300, completedAt: '2026-11-03T08:00:00.000Z', status: 'completed' })).toBe(6900)
  })

  it('guards malformed timestamps and formats consistently', () => {
    expect(calculateElapsedSeconds({ startedAt: 'not-a-date', totalPausedSeconds: 0, status: 'in_progress' })).toBe(0)
    expect(formatElapsed(3661)).toBe('01:01:01')
  })
})
