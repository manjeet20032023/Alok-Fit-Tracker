import { describe, expect, it } from 'vitest'
import { estimated1Rm, getProgressionSuggestion } from './progression'

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
})
