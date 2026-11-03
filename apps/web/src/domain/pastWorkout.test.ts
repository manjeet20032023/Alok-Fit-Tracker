import { describe, expect, it } from 'vitest'
import { validatePastWorkoutExercise, type PastWorkoutExerciseDraft } from './pastWorkout'

const draft = (patch: Partial<PastWorkoutExerciseDraft>): PastWorkoutExerciseDraft => ({
  id: 'draft-1', category: 'weight', name: 'Bench Press', muscleGroup: 'Chest', setCount: '3',
  reps: '10', weightKg: '40', durationSeconds: '', durationMinutes: '', distanceKm: '', speedKph: '', inclinePercent: '', ...patch,
})

describe('past workout entry validation', () => {
  it('accepts cardio duration without strength fields', () => {
    expect(validatePastWorkoutExercise(draft({ category: 'cardio', name: 'Outdoor run', muscleGroup: '', setCount: '', reps: '', weightKg: '', durationMinutes: '25' }))).toBeNull()
  })

  it('accepts timed core sets without weight or reps', () => {
    expect(validatePastWorkoutExercise(draft({ category: 'core', name: 'Plank', muscleGroup: 'Core', reps: '', weightKg: '', durationSeconds: '45' }))).toBeNull()
  })

  it('keeps strength reps and weight required', () => {
    expect(validatePastWorkoutExercise(draft({ weightKg: '' }))).toContain('weight')
    expect(validatePastWorkoutExercise(draft({ reps: '' }))).toContain('reps')
  })
})