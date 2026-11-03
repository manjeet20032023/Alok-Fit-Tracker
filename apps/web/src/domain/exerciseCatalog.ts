import type { Exercise } from '../data/db'

export interface ExerciseOption {
  name: string
  muscleGroup: string
  section: 'weight' | 'core' | 'cardio'
  catalogKey?: string
  exerciseId?: string
}

export const standardExerciseCatalog: ExerciseOption[] = [
  { name: 'Bench Press', muscleGroup: 'Chest', section: 'weight' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', section: 'weight' },
  { name: 'Pec Deck', muscleGroup: 'Chest', section: 'weight' },
  { name: 'Lat Pulldown', muscleGroup: 'Back', section: 'weight' },
  { name: 'Barbell Row', muscleGroup: 'Back', section: 'weight' },
  { name: 'Cable Row', muscleGroup: 'Back', section: 'weight' },
  { name: 'Back Squat', muscleGroup: 'Legs', section: 'weight' },
  { name: 'Leg Press', muscleGroup: 'Legs', section: 'weight' },
  { name: 'Romanian Deadlift', muscleGroup: 'Legs', section: 'weight' },
  { name: 'Leg Extension', muscleGroup: 'Legs', section: 'weight' },
  { name: 'Leg Curl', muscleGroup: 'Legs', section: 'weight' },
  { name: 'Calf Raise', muscleGroup: 'Legs', section: 'weight' },
  { name: 'Overhead Press', muscleGroup: 'Shoulders', section: 'weight' },
  { name: 'Lateral Raise', muscleGroup: 'Shoulders', section: 'weight' },
  { name: 'Cable Curl', muscleGroup: 'Biceps', section: 'weight' },
  { name: 'Barbell Curl', muscleGroup: 'Biceps', section: 'weight' },
  { name: 'Triceps Pushdown', muscleGroup: 'Triceps', section: 'weight' },
  { name: 'Plank', muscleGroup: 'Core', section: 'core' },
  { name: 'Crunch', muscleGroup: 'Core', section: 'core' },
  { name: 'Hanging Leg Raise', muscleGroup: 'Core', section: 'core' },
  { name: 'Dead Bug', muscleGroup: 'Core', section: 'core' },
  { name: 'Treadmill running', muscleGroup: 'Cardio', section: 'cardio' },
  { name: 'Treadmill walking', muscleGroup: 'Cardio', section: 'cardio' },
  { name: 'Incline walking', muscleGroup: 'Cardio', section: 'cardio' },
  { name: 'Outdoor running', muscleGroup: 'Cardio', section: 'cardio' },
  { name: 'Cycling', muscleGroup: 'Cardio', section: 'cardio' },
  { name: 'Elliptical', muscleGroup: 'Cardio', section: 'cardio' },
  { name: 'Rowing machine', muscleGroup: 'Cardio', section: 'cardio' },
  { name: 'Jump rope', muscleGroup: 'Cardio', section: 'cardio' },
]

export function getExerciseCatalog(customExercises: Exercise[] = []): ExerciseOption[] {
  const options: ExerciseOption[] = standardExerciseCatalog.map((item) => ({ ...item, catalogKey: `standard:${item.name}` }))
  const names = new Set(options.map((item) => item.name.toLocaleLowerCase()))
  for (const exercise of customExercises) {
    if (exercise.deletedAt) {
      const standardIndex = exercise.catalogKey ? options.findIndex((item) => item.catalogKey === exercise.catalogKey) : -1
      if (standardIndex >= 0) {
        names.delete(options[standardIndex].name.toLocaleLowerCase())
        options.splice(standardIndex, 1)
      }
      continue
    }
    const section: ExerciseOption['section'] = exercise.exerciseType === 'cardio'
      ? 'cardio'
      : exercise.exerciseType === 'core' || exercise.muscleGroups.some((group) => group.toLocaleLowerCase() === 'core')
        ? 'core'
        : 'weight'
    const option = { name: exercise.name, muscleGroup: exercise.muscleGroups.join(', ') || 'Other', section, catalogKey: exercise.catalogKey, exerciseId: exercise.id }
    const standardIndex = exercise.catalogKey ? options.findIndex((item) => item.catalogKey === exercise.catalogKey) : -1
    if (standardIndex >= 0) {
      names.delete(options[standardIndex].name.toLocaleLowerCase())
      options[standardIndex] = option
    } else if (!names.has(exercise.name.toLocaleLowerCase())) {
      options.push(option)
    }
    names.add(exercise.name.toLocaleLowerCase())
  }
  return options
}

export function getExerciseBodyPartTags(options: ExerciseOption[], section: ExerciseOption['section']) {
  return [...new Set(options.filter((item) => item.section === section).flatMap((item) => item.muscleGroup.split(',').map((tag) => tag.trim()).filter(Boolean)))].sort()
}

export function filterExercises(options: ExerciseOption[], section: ExerciseOption['section'], bodyPart: string) {
  return options.filter((item) => item.section === section && (bodyPart === 'All' || item.muscleGroup.split(',').map((tag) => tag.trim()).includes(bodyPart)))
}