import { describe, expect, it } from 'vitest'
import { estimated1Rm, getCurrentPersonalRecords, getProgressionSuggestion, getRecentStrengthLogs } from './progression'

describe('progression and estimates', () => {
  it('labels Epley estimate and rejects unsuitable rep ranges', () => {
    expect(estimated1Rm(100, 5)).toBeCloseTo(116.67, 2)
    expect(estimated1Rm(100, 11)).toBeNull()
    expect(estimated1Rm(0, 5)).toBeNull()
  })

  it('never recommends an increase with pain or poor form', () => {
    expect(getProgressionSuggestion({ prescribedWorkingSets: 3, completedWorkingSets: 3, maxReps: 12, actualReps: [12, 12, 12], painOrPoorForm: true, incrementKg: 2.5 }).action).toBe('maintain')
  })

  it('recommends a confirmed increment only after all working sets reach the top range', () => {
    expect(getProgressionSuggestion({ prescribedWorkingSets: 3, completedWorkingSets: 3, maxReps: 12, actualReps: [12, 12, 12], painOrPoorForm: false, incrementKg: 2.5 }).action).toBe('increase')
    expect(getProgressionSuggestion({ prescribedWorkingSets: 3, completedWorkingSets: 3, maxReps: 12, actualReps: [12, 10, 12], painOrPoorForm: false, incrementKg: 2.5 }).action).toBe('maintain')
  })

  it('uses the latest completed workout sets for each exercise', () => {
    const logs = getRecentStrengthLogs([
      { id: 'old', localDate: '2026-10-01', timezone: 'UTC', plannedFocus: [], status: 'completed', startedAt: '', pausedAt: null, lastResumedAt: null, totalPausedSeconds: 0, completedAt: '2026-10-01T10:00:00Z', durationSeconds: 600, notes: '', createdAt: '', updatedAt: '', revision: 1, deletedAt: null },
      { id: 'new', localDate: '2026-10-02', timezone: 'UTC', plannedFocus: [], status: 'completed', startedAt: '', pausedAt: null, lastResumedAt: null, totalPausedSeconds: 0, completedAt: '2026-10-02T10:00:00Z', durationSeconds: 600, notes: '', createdAt: '', updatedAt: '', revision: 1, deletedAt: null },
    ], [
      { id: 'old-exercise', workoutId: 'old', name: 'Bench Press', muscleGroup: 'Chest', section: 'weight', order: 0 },
      { id: 'new-exercise', workoutId: 'new', name: 'bench press', muscleGroup: 'Chest', section: 'weight', order: 0 },
    ], [
      { id: 'set-1', workoutExerciseId: 'new-exercise', workoutId: 'new', setNumber: 1, reps: 12, weightKg: 50, durationSeconds: null, completed: true, notes: '' },
      { id: 'set-2', workoutExerciseId: 'new-exercise', workoutId: 'new', setNumber: 2, reps: 8, weightKg: 50, durationSeconds: null, completed: true, notes: '' },
      { id: 'set-3', workoutExerciseId: 'new-exercise', workoutId: 'new', setNumber: 3, reps: 10, weightKg: 50, durationSeconds: null, completed: false, notes: '' },
      { id: 'old-set', workoutExerciseId: 'old-exercise', workoutId: 'old', setNumber: 1, reps: 20, weightKg: 20, durationSeconds: null, completed: true, notes: '' },
    ])

    expect(logs).toEqual([{
      exerciseName: 'bench press',
      workoutId: 'new',
      performedAt: '2026-10-02T10:00:00Z',
      prescribedWorkingSets: 3,
      completedWorkingSets: 2,
      actualReps: [12, 8],
    }])
  })

  it('shows only the current best record per exercise and metric', () => {
    const records = [
      { id: 'old', exerciseName: 'Bench Press', type: 'weight' as const, value: 80, unit: 'kg', workoutId: null, achievedAt: '2026-10-01', createdAt: '', updatedAt: '', deletedAt: null },
      { id: 'best', exerciseName: 'bench press', type: 'weight' as const, value: 90, unit: 'kg', workoutId: null, achievedAt: '2026-10-02', createdAt: '', updatedAt: '', deletedAt: null },
      { id: 'removed', exerciseName: 'Bench Press', type: 'estimated_1rm' as const, value: 120, unit: 'kg', workoutId: null, achievedAt: '2026-10-03', createdAt: '', updatedAt: '', deletedAt: '2026-10-04' },
    ]

    expect(getCurrentPersonalRecords(records).map((record) => record.id)).toEqual(['best'])
  })
})
