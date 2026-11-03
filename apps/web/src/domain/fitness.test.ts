import { describe, expect, it } from 'vitest'
import { calculatePace, calculateSpeed, calculateWeightedVolume } from './fitness'

describe('fitness calculations', () => {
  it('calculates weighted volume only from completed compatible sets', () => {
    expect(calculateWeightedVolume([
      { weightKg: 20, reps: 10, completed: true },
      { weightKg: null, reps: 8, completed: true },
      { weightKg: 25, reps: 12, completed: false },
    ])).toBe(200)
  })

  it('returns null when distance or duration cannot produce a pace/speed', () => {
    expect(calculatePace(1800, null)).toBeNull()
    expect(calculatePace(1800, 0)).toBeNull()
    expect(calculateSpeed(0, 1800)).toBeNull()
  })

  it('calculates pace seconds per km and speed km/h', () => {
    expect(calculatePace(1800, 5000)).toBe(360)
    expect(calculateSpeed(5000, 1800)).toBe(10)
  })
})
