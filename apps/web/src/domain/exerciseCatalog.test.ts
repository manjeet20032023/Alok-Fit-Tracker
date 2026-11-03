import { describe, expect, it } from 'vitest'
import { filterExercises, getExerciseBodyPartTags, getExerciseCatalog } from './exerciseCatalog'

describe('exercise catalog', () => {
  it('provides tagged strength, core, and cardio choices', () => {
    const options = getExerciseCatalog()
    expect(options.find((item) => item.name === 'Bench Press')).toMatchObject({ muscleGroup: 'Chest', section: 'weight' })
    expect(options.find((item) => item.name === 'Plank')).toMatchObject({ muscleGroup: 'Core', section: 'core' })
    expect(options.find((item) => item.name === 'Cycling')).toMatchObject({ muscleGroup: 'Cardio', section: 'cardio' })
  })

  it('adds custom library exercises with their existing muscle tags', () => {
    const options = getExerciseCatalog([
      { id: 'custom-1', name: 'Single-arm row', muscleGroups: ['Back'], equipment: 'Dumbbell', exerciseType: 'strength', instructions: '', isCustom: true, createdAt: '', updatedAt: '', deletedAt: null },
      { id: 'deleted', name: 'Old move', muscleGroups: ['Chest'], equipment: '', exerciseType: 'strength', instructions: '', isCustom: true, createdAt: '', updatedAt: '', deletedAt: '2026-11-03' },
    ])
    expect(options.find((item) => item.name === 'Single-arm row')).toMatchObject({ muscleGroup: 'Back', section: 'weight' })
    expect(options.some((item) => item.name === 'Old move')).toBe(false)
  })

  it('uses saved edits to a standard exercise without showing the original twice', () => {
    const options = getExerciseCatalog([
      { id: 'edit-1', catalogKey: 'standard:Bench Press', name: 'Incline Bench Press', muscleGroups: ['Chest', 'Shoulders'], equipment: 'Barbell', exerciseType: 'strength', instructions: '', isCustom: false, createdAt: '', updatedAt: '', deletedAt: null },
    ])

    expect(options.some((item) => item.name === 'Bench Press')).toBe(false)
    expect(options.find((item) => item.name === 'Incline Bench Press')).toMatchObject({ muscleGroup: 'Chest, Shoulders', section: 'weight' })
  })

  it('keeps deleted built-in exercises out of all pickers', () => {
    const options = getExerciseCatalog([
      { id: 'deleted-1', catalogKey: 'standard:Bench Press', name: 'Bench Press', muscleGroups: ['Chest'], equipment: '', exerciseType: 'strength', instructions: '', isCustom: false, createdAt: '', updatedAt: '', deletedAt: '2026-11-03' },
    ])

    expect(options.some((item) => item.name === 'Bench Press')).toBe(false)
  })

  it('filters exercise choices by both category and body part', () => {
    const options = getExerciseCatalog()
    expect(getExerciseBodyPartTags(options, 'weight')).toContain('Legs')
    expect(filterExercises(options, 'weight', 'Legs').map((item) => item.name)).toContain('Leg Press')
    expect(filterExercises(options, 'weight', 'Legs').some((item) => item.section !== 'weight' || item.muscleGroup !== 'Legs')).toBe(false)
    expect(filterExercises(options, 'core', 'Chest')).toEqual([])
  })
})