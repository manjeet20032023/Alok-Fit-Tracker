export interface PastWorkoutSetDraft {
  reps: string
  weightKg: string
  durationSeconds: string
}

export interface PastWorkoutExerciseDraft {
  id: string
  category: 'weight' | 'core' | 'cardio'
  name: string
  muscleGroup: string
  setCount: string
  reps: string
  weightKg: string
  durationSeconds: string
  durationMinutes: string
  distanceKm: string
  speedKph: string
  inclinePercent: string
  setValues?: PastWorkoutSetDraft[]
}

function isOptionalNonnegative(value: string) {
  return value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0)
}

export function validatePastWorkoutExercise(draft: PastWorkoutExerciseDraft): string | null {
  if (!draft.name.trim()) return 'Enter an exercise or activity name.'

  if (draft.category === 'cardio') {
    if (!Number.isFinite(Number(draft.durationMinutes)) || Number(draft.durationMinutes) <= 0) return 'Enter cardio duration in minutes.'
    if (!isOptionalNonnegative(draft.distanceKm) || !isOptionalNonnegative(draft.speedKph) || !isOptionalNonnegative(draft.inclinePercent)) return 'Cardio speed, distance, and incline must be zero or greater.'
    return null
  }

  if (!Number.isInteger(Number(draft.setCount)) || Number(draft.setCount) < 1) return 'Enter at least one set.'
  const setValues = draft.setValues?.length ? draft.setValues : Array.from({ length: Number(draft.setCount) }, () => ({ reps: draft.reps, weightKg: draft.weightKg, durationSeconds: draft.durationSeconds }))
  if (draft.category === 'weight') {
    if (!draft.muscleGroup.trim()) return 'Enter a muscle group for strength exercises.'
    if (setValues.some((set) => set.reps === '' || !Number.isInteger(Number(set.reps)) || Number(set.reps) < 0)) return 'Enter reps for each strength set.'
    if (setValues.some((set) => set.weightKg === '' || !Number.isFinite(Number(set.weightKg)) || Number(set.weightKg) < 0)) return 'Enter a non-negative weight for each strength set.'
    return null
  }

  if (setValues.some((set) => !isOptionalNonnegative(set.reps) || !isOptionalNonnegative(set.durationSeconds))) return 'Core reps and seconds must be zero or greater.'
  if (setValues.some((set) => set.reps === '' && set.durationSeconds === '')) return 'For core exercises, enter reps or seconds for every set.'
  return null
}