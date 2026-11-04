import { describe, expect, it } from 'vitest'
import { getPreviousMuscleGroupComparison, groupWorkoutsByDate } from './workoutHistory'
import type { Workout } from '../data/db'

const workout = (patch: Partial<Workout>): Workout => ({
  id: 'workout-1', localDate: '2026-11-02', timezone: 'UTC', plannedFocus: ['Back'], location: 'gym',
  status: 'completed', startedAt: '', pausedAt: null, lastResumedAt: null, totalPausedSeconds: 0,
  completedAt: '2026-11-02T18:00:00Z', durationSeconds: 3600, notes: '', createdAt: '', updatedAt: '', revision: 1, deletedAt: null,
  ...patch,
})

describe('workout history summaries', () => {
  it('groups same-day workout records into one date row', () => {
    const groups = groupWorkoutsByDate([
      workout({ id: 'cardio', plannedFocus: ['Cardio'], durationSeconds: 600 }),
      workout({ id: 'strength', plannedFocus: ['Strength training'], durationSeconds: 3600 }),
      workout({ id: 'deleted', deletedAt: '2026-11-03T00:00:00Z' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ focus: ['Cardio', 'Strength training'], locations: ['gym'], durationSeconds: 4200 })
    expect(groups[0].workouts.map((item) => item.id)).toEqual(['cardio', 'strength'])
  })

  it('returns exact previous sets and volume for a muscle group', () => {
    const prior = workout({ id: 'prior', localDate: '2026-11-01' })
    const comparison = getPreviousMuscleGroupComparison([prior], [
      { id: 'row', workoutId: 'prior', name: 'Barbell Row', muscleGroup: 'Back', section: 'weight', order: 0 },
      { id: 'press', workoutId: 'prior', name: 'Bench Press', muscleGroup: 'Chest', section: 'weight', order: 1 },
    ], [
      { id: 'row-set', workoutId: 'prior', workoutExerciseId: 'row', setNumber: 1, reps: 10, weightKg: 50, durationSeconds: null, completed: true, notes: '' },
      { id: 'press-set', workoutId: 'prior', workoutExerciseId: 'press', setNumber: 1, reps: 8, weightKg: 60, durationSeconds: null, completed: true, notes: '' },
    ], '2026-11-02', 'Back')

    expect(comparison?.exercises.map((exercise) => exercise.exerciseName)).toEqual(['Barbell Row'])
    expect(comparison?.totalVolumeKg).toBe(500)
  })
})